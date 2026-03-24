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
    print("AI Scoring Debugger v1")
    if not os.path.exists(MODEL_PATH):
        print("ERROR: deal_model.pkl not found!")
        return

    model = joblib.load(MODEL_PATH)
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("SELECT id, stage, amount, demo_completed, champion_identified, created_at, close_date FROM deals LIMIT 10")
    deals = cur.fetchall()

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

    for d in deals:
        try:
            d_id, stage, amount, demo, champion, created_at, close_date = d
            print(f"Checking Deal {d_id}: Stage={stage}, Amount={amount}")

            note_count = task_counts.get(d_id, 0)
            age = (now - created_at.date()).days
            cd = close_date.date() if hasattr(close_date, 'date') else close_date
            dtc = (cd - now).days
            stage_num = stage_map.get(stage, 1)

            # Features: amount, stage_num, note_count, age, demo, champion, days_to_close
            feat = np.array([[
                amount, stage_num, float(note_count), age, 
                1 if demo else 0, 
                1 if champion else 0, 
                float(dtc)
            ]], dtype=float)

            prob = model.predict_proba(feat)[0][1]
            print(f"  AI Probability: {prob:.4f}")

            cur.execute("UPDATE deals SET ai_score = %s WHERE id = %s", (round(prob * 100, 2), d_id))
            print(f"  Update result: {cur.rowcount} row(s) updated.")
            conn.commit()

        except Exception as e:
            print(f"  FAILURE on Deal {d[0]}: {e}")
            conn.rollback()

    cur.close()
    conn.close()

if __name__ == "__main__":
    debug()
