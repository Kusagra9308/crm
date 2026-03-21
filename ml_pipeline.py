import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, confusion_matrix
from sklearn.calibration import CalibratedClassifierCV
import matplotlib.pyplot as plt
import joblib

# ── Setup ─────────────────────────────────────────────────────────────
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    return psycopg2.connect(DATABASE_URL)

np.random.seed(42)
random.seed(42)

# ── Step 1: Clear old deals ───────────────────────────────────────────
print("Clearing old deals...")
conn = get_connection()
cur = conn.cursor()
cur.execute("DELETE FROM deal_stage_history;")
cur.execute("DELETE FROM deals;")
conn.commit()

# ── Step 2: Generate realistic messy data ─────────────────────────────
print("Generating realistic deals...")

org_id = 1
companies = [1, 2, 3]
owners = ["Alice Freeman", "Bob Smith", "Charlie Brown"]

stages_open = [
    "Appointment Scheduled",
    "Qualified to Buy",
    "Presentation Scheduled",
    "Decision Maker Bought-In",
    "Contract Sent"
]

rows = []

def noisy_bool(p):
    return random.random() < p

# WON deals (not perfect!)
for i in range(200):
    rows.append({
        "name": f"Deal {i+1}",
        "amount": int(np.clip(np.random.normal(16000, 6000), 2000, 25000)),
        "stage": "Closed Won",
        "owner": random.choice(owners),
        "close_date": datetime.now() - timedelta(days=random.randint(1, 90)),
        "company_id": random.choice(companies),
        "organization_id": org_id,
        "email_response_rate": round(np.clip(np.random.normal(0.6, 0.2), 0.05, 1.0), 2),
        "discount_requested": round(np.clip(np.random.normal(0.15, 0.12), 0.0, 0.4), 2),
        "demo_completed": noisy_bool(0.7),
        "champion_identified": noisy_bool(0.65),
    })

# LOST deals (overlap added!)
for i in range(200, 400):
    rows.append({
        "name": f"Deal {i+1}",
        "amount": int(np.clip(np.random.normal(11000, 6000), 2000, 25000)),
        "stage": "Closed Lost",
        "owner": random.choice(owners),
        "close_date": datetime.now() - timedelta(days=random.randint(1, 90)),
        "company_id": random.choice(companies),
        "organization_id": org_id,
        "email_response_rate": round(np.clip(np.random.normal(0.45, 0.2), 0.0, 1.0), 2),
        "discount_requested": round(np.clip(np.random.normal(0.22, 0.12), 0.0, 0.4), 2),
        "demo_completed": noisy_bool(0.45),   # 👈 overlap!
        "champion_identified": noisy_bool(0.4),
    })

# OPEN deals (uncertain zone)
for i in range(400, 500):
    rows.append({
        "name": f"Deal {i+1}",
        "amount": int(np.clip(np.random.normal(13000, 4000), 5000, 22000)),
        "stage": random.choice(stages_open),
        "owner": random.choice(owners),
        "close_date": datetime.now() + timedelta(days=random.randint(10, 180)),
        "company_id": random.choice(companies),
        "organization_id": org_id,
        "email_response_rate": round(np.clip(np.random.normal(0.5, 0.15), 0.2, 0.8), 2),
        "discount_requested": round(np.clip(np.random.normal(0.2, 0.08), 0.05, 0.35), 2),
        "demo_completed": noisy_bool(0.55),
        "champion_identified": noisy_bool(0.5),
    })

df = pd.DataFrame(rows)

# ── Step 3: Insert into DB ────────────────────────────────────────────
print("Inserting deals...")

insert_query = """
INSERT INTO deals (
    name, amount, stage, owner, close_date,
    company_id, organization_id,
    email_response_rate, discount_requested,
    demo_completed, champion_identified, ai_score
) VALUES %s
"""

values = [
    (
        r["name"], r["amount"], r["stage"], r["owner"], r["close_date"],
        r["company_id"], r["organization_id"],
        r["email_response_rate"], r["discount_requested"],
        r["demo_completed"], r["champion_identified"], None
    )
    for _, r in df.iterrows()
]

execute_values(cur, insert_query, values)
conn.commit()

# ── Step 4: Train model ───────────────────────────────────────────────
print("\nTraining model...")

train_df = df[df["stage"].isin(["Closed Won", "Closed Lost"])].copy()
train_df["outcome"] = (train_df["stage"] == "Closed Won").astype(int)

features = [
    "amount",
    "email_response_rate",
    "discount_requested",
    "demo_completed",
    "champion_identified"
]

X = train_df[features].astype(float)
y = train_df["outcome"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

base_model = RandomForestClassifier(
    n_estimators=150,
    max_depth=3,
    min_samples_leaf=30,
    min_samples_split=40,
    random_state=42
)

model = CalibratedClassifierCV(base_model, method="sigmoid", cv=5)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

print(f"Accuracy: {accuracy_score(y_test, y_pred):.2f}")
print(f"AUC: {roc_auc_score(y_test, y_prob):.2f}")
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))

joblib.dump(model, "deal_model.pkl")

# ── Step 5: Score deals (REALISTIC scoring) ───────────────────────────
print("\nScoring deals...")

stage_bias = {
    "Appointment Scheduled": 0.40,
    "Qualified to Buy": 0.50,
    "Presentation Scheduled": 0.60,
    "Decision Maker Bought-In": 0.70,
    "Contract Sent": 0.80
}

cur.execute("""
SELECT id, stage, amount, email_response_rate,
       discount_requested, demo_completed, champion_identified
FROM deals
""")

updates = []

for deal in cur.fetchall():
    deal_id, stage, *vals = deal

    feat = np.array([vals], dtype=float)
    base_prob = model.predict_proba(feat)[0][1]

    # Blend model + stage prior
    blended = 0.6 * base_prob + 0.4 * stage_bias.get(stage, 0.5)

    # Add noise
    blended += np.random.normal(0, 0.05)

    # Clamp
    final_score = float(np.clip(blended, 0.05, 0.95))

    updates.append((round(final_score * 100, 2), deal_id))

cur.executemany("UPDATE deals SET ai_score = %s WHERE id = %s", updates)
conn.commit()

cur.close()
conn.close()

print("✅ Done! AI scores now realistic.")

print("""
Run this to verify:

SELECT stage,
       ROUND(AVG(ai_score),2) avg,
       ROUND(MIN(ai_score),2) min,
       ROUND(MAX(ai_score),2) max
FROM deals
GROUP BY stage
ORDER BY avg;
""")