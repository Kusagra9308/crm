import os
import psycopg2
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
PYTHON_API_URL = "http://localhost:8000"

def get_connection():
    # Use require instead of verify-full to avoid local CA certificate issues
    url = DATABASE_URL.replace("sslmode=verify-full", "sslmode=require")
    return psycopg2.connect(url)

def post_predict(features):
    data = json.dumps(features).encode("utf-8")
    req = urllib.request.Request(f"{PYTHON_API_URL}/predict", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def test_flow():
    conn = get_connection()
    cur = conn.cursor()

    try:
        # 1. Create a fresh Deal
        print("--- Step 1: Create a fresh Deal ---")
        name = "Test Engagement Deal"
        amount = 50000
        stage = "Qualified to Buy"
        # Let's get a real orgId from the DB
        cur.execute("SELECT organization_id FROM users LIMIT 1")
        org_id = cur.fetchone()[0]
        
        cur.execute("""
            INSERT INTO deals (name, amount, stage, organization_id, created_at)
            VALUES (%s, %s, %s, %s, NOW())
            RETURNING id
        """, (name, amount, stage, org_id))
        deal_id = cur.fetchone()[0]
        conn.commit()
        print(f"Deal created with ID: {deal_id} for Org {org_id}")

        # 2. Get Initial AI Score (Simulate the app's initial score calculation)
        print("\n--- Step 2: Get Initial AI Score (0 tasks) ---")
        features = {
            "amount": float(amount),
            "stage": stage,
            "note_count": 0,    # No tasks yet
            "deal_age": 0,       # Initial
            "demo_completed": False,
            "champion_identified": False
        }
        res_initial = post_predict(features)
        score_initial = res_initial["ai_score"]
        print(f"Initial AI Score (0 tasks): {score_initial}%")

        cur.execute("UPDATE deals SET ai_score = %s WHERE id = %s", (score_initial, deal_id))
        conn.commit()

        # 3. Add a Task to that Deal
        print("\n--- Step 3: Add a Task to that Deal ---")
        cur.execute("""
            INSERT INTO tasks (title, deal_id, organization_id, status)
            VALUES (%s, %s, %s, %s)
        """, (f"Follow up with {name}", deal_id, org_id, "Pending"))
        conn.commit()
        print("Task added and linked to deal.")

        # 4. Re-calculate AI Score (Simulate the createTask trigger)
        print("\n--- Step 4: Re-calculate AI Score (1 task) ---")
        features["note_count"] = 1 # Now there is 1 task
        res_after = post_predict(features)
        score_after = res_after["ai_score"]
        print(f"AI Score after 1 Task: {score_after}%")

        cur.execute("UPDATE deals SET ai_score = %s WHERE id = %s", (score_after, deal_id))
        conn.commit()

        # Comparison with a bit of precision margin
        if abs(score_after - score_initial) > 0.001:
            print(f"\n✅ SUCCESS: AI Score changed from {score_initial}% to {score_after}%")
        else:
            print(f"\n❌ FAIL: AI Score remained the same ({score_initial}%). Check if the model uses note_count.")

    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    test_flow()
