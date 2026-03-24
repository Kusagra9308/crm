import os
import psycopg2
import joblib
import numpy as np
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("sslmode=verify-full", "sslmode=require")
MODEL_PATH = "deal_model.pkl"

def debug():
    print("AI Scoring v3 (Bulk Engine)")
    model = joblib.load(MODEL_PATH)
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT id, stage, amount, demo_completed, champion_identified, created_at, close_date FROM deals")
    deals = cur.fetchall()
    print(f"Scoring {len(deals)} deals...")

    cur.execute("SELECT deal_id, COUNT(*) FROM tasks GROUP BY deal_id")
    task_counts = {r[0]: r[1] for r in cur.fetchall()}

    now = datetime.now().date()
    stage_map = {
        "Appointment Scheduled": 1,
        "Qualified to Buy": 2,
        "Presentation Scheduled": 3,
        "Decision Maker Bought-In": 4,
        "Contract Sent": 5
    }

    payload = []
    for d in deals:
        try:
            d_id, stage, amount, demo, champion, created_at, close_date = d
            nc = task_counts.get(d_id, 0)
            age = (now - created_at.date()).days
            cd = close_date.date() if hasattr(close_date, 'date') else close_date
            dtc = (cd - now).days
            sn = stage_map.get(stage, 1)

            feat = np.array([[
                amount, sn, float(nc), age, 
                1 if demo else 0, 1 if champion else 0, float(dtc)
            ]], dtype=float)

            prob = float(model.predict_proba(feat)[0][1])
            payload.append((round(prob * 100, 2), int(d_id)))
        except: continue

    print(f"Preparing batch UPDATE for {len(payload)} deals...")
    from psycopg2.extras import execute_values
    query = "UPDATE deals SET ai_score = data.ai_score FROM (VALUES %s) AS data (ai_score, id) WHERE deals.id = data.id"
    execute_values(cur, query, payload)
    print(f"Update DONE. {len(payload)} rows updated.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    debug()
