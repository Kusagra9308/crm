import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, confusion_matrix
import joblib

# ── Setup ─────────────────────────────────────────────────────────────
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path, override=True)
DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not found in environment!")
    # Use require instead of verify-full to avoid local CA certificate issues
    url = DATABASE_URL.replace("sslmode=verify-full", "sslmode=require")
    print(f"Connecting to: {url.split('@')[-1].split('/')[0]}") # Log host only for safety
    return psycopg2.connect(url)

np.random.seed(42)
random.seed(42)

# ── Step 1: Ensure Schema ─────────────────────────────────────────────
conn = get_connection()
cur = conn.cursor()
conn.autocommit = True
cur.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_stage_num INTEGER")
conn.autocommit = False

cur.execute("SELECT COUNT(*) FROM deals WHERE stage IN ('Closed Won', 'Closed Lost')")
historical_count = cur.fetchone()[0]
print(f"Current historical deal database size: {historical_count}")

# ── Step 2: Generate booster synthetic data (FORCE REBUILD) ──────────
if True: # Force rebuild once for the new milestone correlation
    # Clear once to fix the task-less deals
    cur.execute("DELETE FROM tasks; DELETE FROM deals;")
    conn.commit()
    print(f"Force rebuild: Cleared deals to fix task density patterns.")
    print(f"Database reflects a new organization (<100 deals). Generating booster data...")
    print("Fetching unique organization IDs...")
    cur.execute("SELECT DISTINCT organization_id FROM users")
    org_ids = [r[0] for r in cur.fetchall()]
    if not org_ids:
        org_ids = [1] # Fallback
    print(f"Found organizations: {org_ids}")

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

    for org_id in org_ids:
        print(f"Generating Logistic-Smooth data for Org {org_id}...")
        # V6: High-Resolution Training (1000 deals per org to eliminate noise/inversions)
        for i in range(100):
            # 1. Activity Distribution (0 to 15 tasks)
            nc = random.randint(0, 15)
            
            # 2. Milestones
            demo = noisy_bool(0.35)
            champion = noisy_bool(0.30)
            lsn = random.randint(1, 4) # Lower stage
            amt = random.randint(5000, 200000) # Wide range
            
            # 🚀 V8 "Aggressive Momentum" Weights
            # Designed for a "High Stakes" demo experience. 
            # Demos and advanced stages now command significant probability floor.
            
            # Base logic + Stage momentum (up to 30% for 'Contract Sent')
            score = 0.20 + (nc * 0.05) + (lsn * 0.06) + (amt / 100000.0 * 0.05)
            
            # Milestone Multipliers (The "Wow Factor")
            if demo: score += 0.35      # Huge jump for product demo
            if champion: score += 0.15  # Solid boost for stakeholder buy-in
            
            # 4. Final Outcome (Closed Won/Lost) 
            outcome_p = np.clip(score, 0.05, 0.95)
            is_won = noisy_bool(outcome_p)
            
            rows.append({
                "name": f"Deal {org_id}-{i+1}",
                "amount": amt,
                "stage": "Closed Won" if is_won else "Closed Lost",
                "last_stage_num": lsn,
                "owner": random.choice(owners),
                "close_date": datetime.now() - timedelta(days=random.randint(0, 60)),
                "company_id": random.choice(companies),
                "organization_id": org_id,
                "note_count": nc,
                "deal_age": random.randint(5, 90),
                "demo_completed": demo,
                "champion_identified": champion,
                "days_to_close": random.randint(-5, 10)
            })

        # Add a few representative 'Open' deals specifically for the dashboard
        for i in range(20):
            rows.append({
                "name": f"Current Active-{i+1}",
                "amount": random.randint(10000, 30000),
                "stage": random.choice(stages_open),
                "last_stage_num": 3,
                "owner": random.choice(owners),
                "close_date": datetime.now() + timedelta(days=random.randint(5, 60)),
                "company_id": random.choice(companies),
                "organization_id": org_id,
                "note_count": random.randint(1, 5),
                "deal_age": random.randint(1, 20),
                "demo_completed": False,
                "champion_identified": False,
                "days_to_close": random.randint(5, 60)
            })

    df = pd.DataFrame(rows)

    # ── Step 3: Insert into DB (Batch) ────────────────────────────────────
    print("Inserting activity-aware deals...")

    # RETURNING id and the name so we can map note_counts back
    insert_query = """
    INSERT INTO deals (
        name, amount, stage, owner, close_date,
        company_id, organization_id, 
        demo_completed, champion_identified, ai_score, last_stage_num, created_at
    ) VALUES %s
    RETURNING id, name, organization_id
    """
    
    deal_values = []
    # Store note_count by name for the task generator
    nc_map = {}
    for _, r in df.iterrows():
        lsn = int(r["last_stage_num"]) if pd.notnull(r.get("last_stage_num")) else None
        nc_map[r["name"]] = int(r["note_count"])
        
        deal_values.append((
            r["name"], r["amount"], r["stage"], r["owner"], r["close_date"],
            r["company_id"], r["organization_id"],
            r["demo_completed"], r["champion_identified"], None, lsn,
            datetime.now() - timedelta(days=int(r["deal_age"]))
        ))

    from psycopg2.extras import execute_values
    inserted_deals = execute_values(cur, insert_query, deal_values, fetch=True)
    conn.commit()

    # Generate synthetic tasks matching the Booster's intended note_count
    print("Generating booster tasks...")
    t_vals = []
    for d_id, name, org_id in inserted_deals:
        num_t = nc_map.get(name, 0)
        for _ in range(num_t):
            t_vals.append((
                f"Boost task for {name}",
                "COMPLETED",
                d_id,
                org_id,
                datetime.now() - timedelta(days=random.randint(0, 30))
            ))
            
    if t_vals:
        execute_values(cur, "INSERT INTO tasks (title, status, deal_id, organization_id, created_at) VALUES %s", t_vals)
        conn.commit()
        print(f"Generated {len(t_vals)} correlated booster tasks.")
else:
    print(f"Organization has sufficient real deal history. Skipping synthetic generation.")

# Re-fetch for Step 5 scoring
cur.execute("SELECT id, stage, amount, demo_completed, champion_identified, created_at, close_date FROM deals")
inserted_deals = cur.fetchall()
print(f"Inserted and fetched {len(inserted_deals)} deals.")

# ── Step 4: Fetch training data from DB ────────────────────────────────
print("\nPreparing training data for model...")
train_query = """
SELECT d.amount, d.stage, d.demo_completed, d.champion_identified, d.close_date, d.created_at, d.last_stage_num,
       (SELECT COUNT(*) FROM tasks t WHERE t.deal_id = d.id) as note_count,
       (CASE WHEN d.stage = 'Closed Won' THEN 1 ELSE 0 END) as outcome
FROM deals d
WHERE d.stage IN ('Closed Won', 'Closed Lost')
"""
train_df = pd.read_sql(train_query, conn)

if train_df.empty:
    raise ValueError("No training data found! Run with synthetic booster.")

# Calculate deal_age from created_at in python to match predict logic
now_ts = pd.Timestamp.now(tz='UTC')
train_df["deal_age"] = (now_ts - pd.to_datetime(train_df["created_at"], utc=True)).dt.days
train_df["days_to_close"] = (pd.to_datetime(train_df["close_date"], utc=True) - now_ts).dt.days

# Use explicitly mapped stage_numeric if available, else default
train_df["stage_numeric"] = train_df["last_stage_num"].fillna(3)

# We already have outcomes and features
print(f"Training on {len(train_df)} historical deals.")

features = [
    "amount",
    "stage_numeric",
    "note_count",
    "deal_age",
    "demo_completed",
    "champion_identified",
    "days_to_close"
]

X = train_df[features].astype(float)
y = train_df["outcome"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# THE 'PROFESSOR DEMO' LINEAR PIPELINE
# StandardScaler: Makes 10,000 INR and 1 Task have equal weight impact
# LogisticRegression: Ensures a smooth, 'curvy' probability response 
model = Pipeline([
    ('scaler', StandardScaler()),
    ('model', LogisticRegression(random_state=42, class_weight='balanced'))
])
model.fit(X_train, y_train)

y_prob = model.predict_proba(X_test)[:, 1]
print(f"Accuracy: {accuracy_score(y_test, model.predict(X_test)):.2f}")
print(f"AUC: {roc_auc_score(y_test, y_prob):.2f}")

joblib.dump(model, "deal_model.pkl")

# ── Step 5: Score deals (Vectorized Engine) ─────────────────────────────
print("\nScoring deals...")

now = datetime.now().date()
stage_map = {
    "Appointment Scheduled": 1,
    "Qualified to Buy": 2,
    "Presentation Scheduled": 3,
    "Decision Maker Bought-In": 4,
    "Contract Sent": 5
}

print("Fetching activity density counts...")
cur.execute("SELECT deal_id, COUNT(*) FROM tasks GROUP BY deal_id")
task_counts = {r[0]: r[1] for r in cur.fetchall()}

print(f"Preparing scores for {len(inserted_deals)} deals...")
feat_list = []
deal_ids = []

for d in inserted_deals:
    try:
        d_id, stage, amount, demo, champion, created_at, close_date = d
        nc = task_counts.get(d_id, 0)
        age = (now - created_at.date()).days
        cd = close_date.date() if hasattr(close_date, 'date') else close_date
        dtc = (cd - now).days
        sn = stage_map.get(stage, 1)

        feat_list.append([amount, sn, float(nc), float(age), 1 if demo else 0, 1 if champion else 0, float(dtc)])
        deal_ids.append(int(d_id))
    except: continue

if feat_list:
    print(f"Vectorized prediction for {len(feat_list)} deals...")
    X_score = np.array(feat_list, dtype=float)
    probs = model.predict_proba(X_score)[:, 1]
    
    update_payload = [(float(round(p * 100, 2)), deal_ids[i]) for i, p in enumerate(probs)]
    print(f"Bulk updating {len(update_payload)} scores via temporary table...")
    
    # ── Robust Bulk Update Logic ──────────────────────────────────────
    # Using a staged table ensures 100% commit reliability for large datasets
    cur.execute("CREATE TEMP TABLE temp_ai_scores (ai_score NUMERIC, id INTEGER)")
    from psycopg2.extras import execute_values
    execute_values(cur, "INSERT INTO temp_ai_scores (ai_score, id) VALUES %s", update_payload)
    
    cur.execute("""
        UPDATE deals 
        SET ai_score = s.ai_score 
        FROM temp_ai_scores s 
        WHERE deals.id = s.id
    """)
    conn.commit()
    print("AI scoring update complete.")

cur.close()
conn.close()

print("✅ Memory-density model and activity-scoring complete.")

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