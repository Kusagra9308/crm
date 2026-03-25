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
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.calibration import CalibratedClassifierCV
import matplotlib.pyplot as plt
import joblib


env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path, override=True)
DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not found in environment!")
    url = DATABASE_URL.replace("sslmode=verify-full", "sslmode=require")
    print(f"Connecting to: {url.split('@')[-1].split('/')[0]}")
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
conn.autocommit = False

cur.execute("SELECT COUNT(*) FROM deals WHERE stage IN ('Closed Won', 'Closed Lost')")
historical_count = cur.fetchone()[0]

MINIMUM_DEALS = 500
needed = max(0, MINIMUM_DEALS - historical_count)

if needed > 0:
    print(
        f"Hybrid Mode: Detected {historical_count} deals. Generating {needed} synthetic deals to reach target of {MINIMUM_DEALS}."
    )

    cur.execute("SELECT DISTINCT organization_id FROM users")
    org_ids = [r[0] for r in cur.fetchall()]
    if not org_ids:
        org_ids = [1]

    # Target Org 11 specifically for the audit demo
    if 11 not in org_ids:
        org_ids.append(11)

    # 🎯 TARGET: Redo changes for Sharma Enterprise (Org 11)
    org_ids = [o for o in org_ids if o == 11] or [11]
    print(f"Targeting Organizations: {org_ids}")

    companies = [1, 2, 3]
    owners = ["Alice Freeman", "Bob Smith", "Charlie Brown"]
    rows = []

    deals_per_org = max(1, needed // len(org_ids))

    for org_id in org_ids:
        print(f"Adding {deals_per_org} hybrid deals for Org {org_id}...")
        for i in range(deals_per_org):
            nc = random.randint(0, 15)
            demo = noisy_bool(0.35)
            champion = noisy_bool(0.30)
            age = random.randint(5, 180)
            lsn = get_realistic_stage(nc, demo, champion, age)
            amt = random.randint(5000, 200000)

            nc_norm = nc / 10.0
            amt_norm = amt / 200000.0
            age_norm = age / 180.0
            dtc = -random.randint(1, 180)
            dtc_norm = dtc / 180.0
            stage_norm = lsn / 5.0

            logit = (
                -1.0
                + 0.50 * stage_norm
                + 0.60 * (1 if demo else 0)
                + 0.40 * (1 if champion else 0)
                + 0.35 * nc_norm
                - 0.20 * age_norm
                - 0.25 * abs(dtc_norm)
                - 0.10 * amt_norm
            )

            outcome_p = 1 / (1 + np.exp(-logit))

            outcome_p = np.clip(outcome_p + np.random.normal(0, 0.03), 0.05, 0.95)
            is_won = noisy_bool(outcome_p)

            rows.append(
                {
                    "name": f"Ideal Deal {org_id}-{i+1}",
                    "amount": amt,
                    "stage": "Closed Won" if is_won else "Closed Lost",
                    "last_stage_num": lsn,
                    "owner": random.choice(owners),
                    "close_date": datetime.now() + timedelta(days=dtc),
                    "company_id": random.choice(companies),
                    "organization_id": org_id,
                    "note_count": nc,
                    "deal_age": age,
                    "demo_completed": demo,
                    "champion_identified": champion,
                    "days_to_close": dtc,
                    "is_synthetic": True,
                }
            )

        for i in range(20):
            demo = noisy_bool(0.35)
            champion = noisy_bool(0.30)
            nc = random.randint(0, 8)
            age = random.randint(1, 20)
            lsn = get_realistic_stage(nc, demo, champion, age)
            dtc = random.randint(5, 60)
            rows.append(
                {
                    "name": f"Current Active-{i+1}",
                    "amount": random.randint(10000, 30000),
                    "stage": random.choice(OPEN_STAGES),
                    "last_stage_num": lsn,
                    "owner": random.choice(owners),
                    "close_date": datetime.now() + timedelta(days=dtc),
                    "company_id": random.choice(companies),
                    "organization_id": org_id,
                    "note_count": nc,
                    "deal_age": age,
                    "demo_completed": demo,
                    "champion_identified": champion,
                    "days_to_close": dtc,
                    "is_synthetic": True,
                }
            )

    df = pd.DataFrame(rows)

    print("Inserting deals...")
    insert_query = """
    INSERT INTO deals (
        name, amount, stage, owner, close_date,
        company_id, organization_id, 
        demo_completed, champion_identified, ai_score, last_stage_num, created_at, is_synthetic
    ) VALUES %s
    RETURNING id, name, organization_id
    """

    nc_map = {}
    deal_values = []
    for _, r in df.iterrows():
        lsn = int(r["last_stage_num"]) if pd.notnull(r.get("last_stage_num")) else None
        nc_map[r["name"]] = int(r["note_count"])
        deal_values.append(
            (
                r["name"],
                r["amount"],
                r["stage"],
                r["owner"],
                r["close_date"],
                r["company_id"],
                r["organization_id"],
                r["demo_completed"],
                r["champion_identified"],
                None,
                lsn,
                datetime.now() - timedelta(days=int(r["deal_age"])),
                r["is_synthetic"],
            )
        )

    inserted_deals = execute_values(cur, insert_query, deal_values, fetch=True)
    print("Generating tasks...")
    t_vals = []
    # FIX: RETURNING id captures real IDs for attachment
    for d_id, deal_name, org_id in inserted_deals:
        nc = nc_map.get(deal_name, 0)
        for _ in range(nc):
            t_vals.append(
                (
                    f"Activity for {deal_name}",
                    "Synthetic activity log for ML training",
                    "Completed",
                    d_id,
                    org_id,
                    datetime.now() - timedelta(days=random.randint(0, 30)),
                )
            )
    if t_vals:
        execute_values(
            cur,
            """
            INSERT INTO tasks (title, description, status, deal_id, organization_id, due_date) 
            VALUES %s
        """,
            t_vals,
        )
        conn.commit()
        print(f"Generated {len(t_vals)} tasks.")
else:
    print(
        f"Sufficient real data ({historical_count} deals). Skipping synthetic generation."
    )


cur.execute(
    "SELECT id, stage, amount, demo_completed, champion_identified, created_at, close_date FROM deals"
)
all_deals = cur.fetchall()
print(f"Total deals to score: {len(all_deals)}")


print("\nFetching training data...")
train_query = """
SELECT d.amount, d.demo_completed, d.champion_identified,
       d.close_date, d.created_at, d.last_stage_num, d.is_synthetic,
       (SELECT COUNT(*) FROM tasks t WHERE t.deal_id = d.id) AS note_count,
       (CASE WHEN d.stage = 'Closed Won' THEN 1 ELSE 0 END) AS outcome
FROM deals d
WHERE d.stage IN ('Closed Won', 'Closed Lost')
"""
train_df = pd.read_sql(train_query, conn)

if train_df.empty:
    raise ValueError("No training data found!")

now_ts = pd.Timestamp.now(tz="UTC")
train_df["deal_age"] = (
    now_ts - pd.to_datetime(train_df["created_at"], utc=True)
).dt.days

train_df["days_to_close"] = (
    pd.to_datetime(train_df["close_date"], utc=True)
    - pd.to_datetime(train_df["created_at"], utc=True)
).dt.days
train_df["stage_numeric"] = train_df["last_stage_num"].fillna(3).astype(float)

train_df["note_count"] = np.log1p(train_df["note_count"])
train_df["stage_demo"] = train_df["stage_numeric"] * train_df["demo_completed"]
train_df["stage_notes"] = train_df["stage_numeric"] * train_df["note_count"]
train_df["activity_recency"] = train_df["note_count"] / (train_df["deal_age"] + 1)
train_df["stalled"] = (
    (train_df["note_count"] == 0) & (train_df["deal_age"] > 30)
).astype(float)


train_df["late_stage_risk"] = (
    (train_df["stage_numeric"] >= 0.8) & (train_df["note_count"] < np.log1p(5))
).astype(float)

train_df["milestone_gap"] = (
    (train_df["stage_numeric"] >= 0.6) & (train_df["demo_completed"] == 0)
).astype(float)


train_df["deal_age"] = train_df["deal_age"] / 180.0
train_df["days_to_close"] = train_df["days_to_close"] / 180.0
train_df["stage_numeric"] = train_df["stage_numeric"] / 5.0
train_df["amount"] = train_df["amount"] / 200000.0


features = [
    "amount",
    "stage_numeric",
    "note_count",
    "deal_age",
    "demo_completed",
    "champion_identified",
    "days_to_close",
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



print("\n── Shadow Model Audit (No-Stage) ──")
features_no_stage = [f for f in features if "stage" not in f]
X_train_shadow = X_train[features_no_stage]
X_test_shadow = X_test[features_no_stage]

shadow_pipeline = Pipeline(
    [("clf", CalibratedClassifierCV(LogisticRegression(C=0.1, random_state=42), cv=5))]
)
shadow_pipeline.fit(X_train_shadow, y_train, clf__sample_weight=sample_weight_train)
y_prob_shadow = shadow_pipeline.predict_proba(X_test_shadow)[:, 1]
auc_shadow = roc_auc_score(y_test, y_prob_shadow)

print(f"Full Model AUC (with stage) : {roc_auc_score(y_test, y_prob):.2f}")
print(f"Shadow Model AUC (no stage) : {auc_shadow:.2f}")
print(f"Leakage Weight (Delta)      : {roc_auc_score(y_test, y_prob) - auc_shadow:.2f}")
if (roc_auc_score(y_test, y_prob) - auc_shadow) > 0.15:
    print("⚠️ WARNING: Model is heavily dependent on stage signal (shortcut risk).")
else:
    print("✅ OK: Behavioral signals are driving the model robustness.")

try:
    first_clf = model.named_steps["clf"].calibrated_classifiers_[0].base_estimator
    coef_df = pd.DataFrame({"feature": features, "coefficient": first_clf.coef_[0]})
    coef_df = coef_df.sort_values("coefficient", ascending=True)
    coef_df.plot(kind="barh", x="feature", y="coefficient", color="skyblue")
    plt.title("Winning Factors Significance")
    plt.grid(axis="x", linestyle="--", alpha=0.7)
    plt.tight_layout()
    plt.savefig("feature_importance.png")
except Exception as e:
    print(f"Chart skipped/Simplified: Calibration doesn't export easy coefficients.")

joblib.dump(model, "deal_model.pkl")


now = datetime.now().date()

cur.execute("SELECT deal_id, COUNT(*) FROM tasks GROUP BY deal_id")
task_counts = {r[0]: r[1] for r in cur.fetchall()}

feat_list = []
deal_ids = []

for d in all_deals:
    try:
        d_id, stage, amount, demo, champion, created_at, close_date = d
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
        rec = nc_log / (float(age) / 180.0 + 1.0)
        stall = 1.0 if (nc == 0 and age > 30) else 0.0

        ls_risk = 1.0 if (sn >= 4 and nc < 5) else 0.0
        m_gap = 1.0 if (sn >= 3 and demo == 0) else 0.0

        feat_list.append(
            [
                amt_norm,
                st_norm,
                nc_log,
                age_norm,
                float(1 if demo else 0),
                float(1 if champion else 0),
                dtc_norm,
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
    print(f"Scored and updated {len(update_payload)} deals. ✅")

cur.close()
conn.close()
