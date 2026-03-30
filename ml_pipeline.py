import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.calibration import CalibratedClassifierCV
import matplotlib.pyplot as plt
import joblib
import sys
import warnings
warnings.filterwarnings("ignore")


env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path, override=True)
DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not found in environment!")
    url = DATABASE_URL.replace("sslmode=verify-full", "sslmode=require")
    return psycopg2.connect(url)


np.random.seed(42)
random.seed(42)

STAGE_MAP = {
    "Appointment Scheduled": 1,
    "Qualified to Buy": 2,
    "Presentation Scheduled": 3,
    "Decision Maker Bought-In": 4,
    "Contract Sent": 5,
    "Closed Won": 3,
    "Closed Lost": 3,
}

OPEN_STAGES = [
    "Appointment Scheduled",
    "Qualified to Buy",
    "Presentation Scheduled",
    "Decision Maker Bought-In",
    "Contract Sent",
]

STAGE_WEIGHT = {
    1: 0.00,
    2: 0.06,
    3: 0.14,
    4: 0.24,
    5: 0.38,
}

STAGE_ACTIVITY_MULT = {
    1: 0.5,
    2: 0.7,
    3: 1.0,
    4: 1.3,
    5: 1.6,
}


def noisy_bool(p):
    return random.random() < p


def get_realistic_stage(nc, demo, champion, age):
    stage = 1

    if nc >= 2:
        stage = 2

    if demo:
        stage = 3

    if champion:
        stage = 4

    if demo and champion and nc >= 8:
        stage = 5

    if age > 60 and nc < 3:
        stage = min(stage, 2)

    if random.random() < 0.1:
        stage = max(1, min(5, stage + random.choice([-1, 1])))

    return int(stage)


conn = get_connection()
cur = conn.cursor()
conn.autocommit = True
cur.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_stage_num INTEGER")
cur.execute(
    "ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE"
)
# Skipping automatic data generation to preserve custom Indian CRM simulation.
print("ML Pipeline: Preservation mode ACTIVE. Training on existing real/custom data.")

# --- NEW: Calculate Company AI Scores ---
print("Calculating Company AI Scores based on historical performance...")
cur.execute("""
    WITH company_stats AS (
        SELECT 
            company_id,
            COUNT(*) FILTER (WHERE stage = 'Closed Won') as wins,
            COUNT(*) FILTER (WHERE stage IN ('Closed Won', 'Closed Lost')) as total
        FROM deals
        WHERE company_id IS NOT NULL
        GROUP BY company_id
    )
    SELECT company_id, wins, total FROM company_stats
""")
stats = cur.fetchall()
update_stats = []
for cid, wins, total in stats:
    # Laplace smoothing: (wins + 1) / (total + 2)
    score = (wins + 1.0) / (total + 2.0)
    update_stats.append((score, cid))

if update_stats:
    execute_values(cur, "UPDATE companies SET ai_score = s.score FROM (VALUES %s) AS s(score, id) WHERE companies.id = s.id", update_stats)
    conn.commit()
    print(f"Updated scores for {len(update_stats)} companies.")

cur.execute("SELECT id, stage, amount, demo_completed, champion_identified, created_at, close_date, company_id FROM deals")
all_deals = cur.fetchall()

# Pre-fetch company scores for scoring loop
cur.execute("SELECT id, ai_score FROM companies")
company_scores = {r[0]: r[1] for r in cur.fetchall()}


train_query = """
SELECT d.amount, d.demo_completed, d.champion_identified,
       d.close_date, d.created_at, d.last_stage_num, d.is_synthetic,
       COALESCE(c.ai_score, 0.5) as company_score,
       (SELECT COUNT(*) FROM tasks t WHERE t.deal_id = d.id) AS note_count,
       (CASE WHEN d.stage = 'Closed Won' THEN 1 ELSE 0 END) AS outcome
FROM deals d
LEFT JOIN companies c ON d.company_id = c.id
WHERE d.stage IN ('Closed Won', 'Closed Lost')
"""
train_df = pd.read_sql(train_query, conn)

# --- FEATURE ENGINEERING V2: Pruning and Hygiene ---
now_ts = pd.Timestamp.now(tz="UTC")
train_df["stage_numeric"] = train_df["last_stage_num"].fillna(3).astype(float) / 5.0
train_df["note_count_raw"] = train_df["note_count"]
train_df["note_count"] = np.log1p(train_df["note_count"])
train_df["deal_age_days"] = (now_ts - pd.to_datetime(train_df["created_at"], utc=True)).dt.days
train_df["deal_age"] = train_df["deal_age_days"] / 180.0

train_df["stage_demo"] = train_df["stage_numeric"] * train_df["demo_completed"]
train_df["stage_notes"] = train_df["stage_numeric"] * train_df["note_count"]

# Fix Stalled Logic: HARD PENALTY
train_df["stalled"] = (
    (train_df["note_count_raw"] == 0) & (train_df["deal_age_days"] > 30)
).astype(float)

# Fix Activity Recency: Scale for impact
train_df["activity_recency"] = (train_df["note_count"] + 0.1) / (train_df["deal_age"] + 1.0)

# Critical Guards for late stage
train_df["late_stage_risk"] = (
    (train_df["stage_numeric"] >= 0.8) & (train_df["note_count_raw"] < 5)
).astype(float)

train_df["milestone_gap"] = (
    (train_df["stage_numeric"] >= 0.6) & (train_df["demo_completed"] == 0)
).astype(float)

# Normalize other factors
train_df["days_to_close"] = (
    pd.to_datetime(train_df["close_date"], utc=True)
    - pd.to_datetime(train_df["created_at"], utc=True)
).dt.days / 180.0
train_df["amount"] = train_df["amount"] / 200000.0

# --- FEATURE SELECTION (Pruned stage_numeric to fix sign flip) ---
features = [
    "amount",
    "note_count",
    "deal_age",
    "demo_completed",
    "champion_identified",
    "days_to_close",
    "company_score",
    "stage_demo",
    "stage_notes",
    "activity_recency",
    "stalled",
    "late_stage_risk",
    "milestone_gap",
]

X = train_df[features].astype(float)
y = train_df["outcome"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)


train_df["sample_weight"] = train_df["is_synthetic"].apply(lambda x: 0.5 if x else 1.0)
sample_weight_train = train_df.loc[X_train.index, "sample_weight"]


X_train_scaled = X_train
X_test_scaled = X_test

base_lr = LogisticRegression(
    C=0.1, max_iter=1000, random_state=42, class_weight="balanced"
)
calibrator = CalibratedClassifierCV(base_lr, method="sigmoid", cv=5)
calibrator.fit(X_train_scaled, y_train, sample_weight=sample_weight_train)


model = Pipeline([("clf", calibrator)])

y_prob = model.predict_proba(X_test)[:, 1]

features_no_stage = [f for f in features if "stage" not in f]
X_train_shadow = X_train[features_no_stage]
X_test_shadow = X_test[features_no_stage]

shadow_pipeline = Pipeline(
    [("clf", CalibratedClassifierCV(LogisticRegression(C=0.1, random_state=42), cv=5))]
)
shadow_pipeline.fit(X_train_shadow, y_train, clf__sample_weight=sample_weight_train)
y_prob_shadow = shadow_pipeline.predict_proba(X_test_shadow)[:, 1]
auc_shadow = roc_auc_score(y_test, y_prob_shadow)

if (roc_auc_score(y_test, y_prob) - auc_shadow) > 0.15:
    print("[WARN] WARNING: Model is heavily dependent on stage signal (shortcut risk).")
else:
    print("[OK] OK: Behavioral signals are driving the model robustness.")

try:
    internal_calib = model.named_steps["clf"].calibrated_classifiers_[0]
    first_clf = None
    if hasattr(internal_calib, "estimator"):
        first_clf = internal_calib.estimator
    else:
        first_clf = internal_calib.base_estimator
        
    coef_df = pd.DataFrame({"feature": features, "coefficient": first_clf.coef_[0]})
    coef_df = coef_df.sort_values("coefficient", ascending=True)
    print("\n--- Winning Factors Coefficients ---")
    print(coef_df)
    print("------------------------------------\n")
    sys.stdout.flush()
    coef_df.plot(kind="barh", x="feature", y="coefficient", color="skyblue")
    plt.title("Winning Factors Significance")
    plt.grid(axis="x", linestyle="--", alpha=0.7)
    plt.tight_layout()
    plt.savefig("feature_importance.png")
except Exception as e:
    print(f"Chart skipped/Simplified: {e}")

joblib.dump(model, "deal_model.pkl")


now = datetime.now().date()

cur.execute("SELECT deal_id, COUNT(*) FROM tasks GROUP BY deal_id")
task_counts = {r[0]: r[1] for r in cur.fetchall()}

feat_list = []
deal_ids = []

for d in all_deals:
    try:
        d_id, stage, amount, demo, champion, created_at, close_date, comp_id = d
        nc = task_counts.get(d_id, 0)
        age = (now - created_at.date()).days
        cd = close_date.date() if hasattr(close_date, "date") else close_date
        cr = created_at.date() if hasattr(created_at, "date") else created_at
        dtc = (cd - cr).days
        sn = STAGE_MAP.get(stage, 3)

        amt_norm = float(amount) / 200000.0
        age_norm = np.clip(float(age), 0, 180) / 180.0
        dtc_norm = np.clip(float(dtc), -180, 180) / 180.0
        st_norm = float(sn) / 5.0

        nc_log = np.log1p(float(nc))
        sd = st_norm * float(1 if demo else 0)
        sn_nc = st_norm * nc_log
        rec = (nc_log + 0.1) / (age_norm + 1.0)
        stall = 1.0 if (nc == 0 and age > 30) else 0.0

        ls_risk = 1.0 if (sn >= 4 and nc < 5) else 0.0
        m_gap = 1.0 if (sn >= 3 and demo == 0) else 0.0
        comp_score = float(company_scores.get(comp_id, 0.5))

        feat_list.append(
            [
                amt_norm,
                nc_log,
                age_norm,
                float(1 if demo else 0),
                float(1 if champion else 0),
                dtc_norm,
                comp_score,
                sd,
                sn_nc,
                rec,
                stall,
                ls_risk,
                m_gap,
            ]
        )
        deal_ids.append(int(d_id))
    except Exception as e:
        print(f"Skipping deal {d_id}: {e}")

if feat_list:
    X_score = np.array(feat_list, dtype=float)
    probs = model.predict_proba(X_score)[:, 1]

    update_payload = [
        (float(round(p * 100, 2)), deal_ids[i]) for i, p in enumerate(probs)
    ]

    cur.execute(
        "DROP TABLE IF EXISTS temp_ai_scores; CREATE TEMP TABLE temp_ai_scores (ai_score NUMERIC, id INTEGER)"
    )
    execute_values(cur, "INSERT INTO temp_ai_scores VALUES %s", update_payload)
    cur.execute(
        """
        UPDATE deals
        SET ai_score = s.ai_score
        FROM temp_ai_scores s
        WHERE deals.id = s.id
    """
    )
    conn.commit()

cur.close()
conn.close()
