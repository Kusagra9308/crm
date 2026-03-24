import psycopg2
import os
import random
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# --- Database Setup ---
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found!")
url = DATABASE_URL.replace("sslmode=verify-full", "sslmode=require")
conn = psycopg2.connect(url)
cur = conn.cursor()

ORG_ID = 11
OWNER_NAME = "Rahul Sharma"
PYTHON_API_URL = os.getenv("PYTHON_API_URL", "https://crm-iogr.onrender.com")

def rebuild():
    print(f"--- 🧹 Cleaning and REBUILDING Demo Data for {OWNER_NAME} (Org {ORG_ID}) ---")

    # 1. Purge everything for Org 11
    cur.execute("DELETE FROM tasks WHERE organization_id = %s", (ORG_ID,))
    cur.execute("DELETE FROM deals WHERE organization_id = %s", (ORG_ID,))
    cur.execute("DELETE FROM contacts WHERE organization_id = %s", (ORG_ID,))
    cur.execute("DELETE FROM companies WHERE organization_id = %s", (ORG_ID,))
    conn.commit()

    # 2. Re-create Companies
    company_data = [
        ("NexaTech Corp", "Technology"),
        ("GreenGrid Energy", "Environment"),
        ("HealthPulse Systems", "Healthcare"),
        ("EcoLoom Textiles", "Manufacturing"),
        ("DataFlow Analytics", "Technology")
    ]
    comp_ids = []
    for name, ind in company_data:
        cur.execute("INSERT INTO companies (name, industry, organization_id) VALUES (%s, %s, %s) RETURNING id", (name, ind, ORG_ID))
        comp_ids.append(cur.fetchone()[0])
    
    # 3. Targeted 4-Month Revenue Calibration (Dec, Jan, Feb, Mar)
    today = datetime.now()
    
    # Precise Monthly Targets
    # Nov, Dec, Jan, Feb, Mar
    monthly_targets = {
        'Nov': 160000,
        'Dec': 180000,
        'Jan': 210000,
        'Feb': 240000,
        'Mar': 130000
    }

    m_offsets = {
        'Nov': -120,
        'Dec': -90,
        'Jan': -60,
        'Feb': -30,
        'Mar': 0
    }

    for month_name, target_rev in monthly_targets.items():
        m_date = today + timedelta(days=m_offsets[month_name])
        
        # Split target into 2 deals
        num_wins = 2
        for w in range(num_wins):
            amt = (target_rev // num_wins) + random.randint(-5000, 5000)
            c_id = random.choice(comp_ids)
            cur.execute("SELECT name FROM companies WHERE id = %s", (c_id,))
            c_name = cur.fetchone()[0]
            
            close_date = m_date.replace(day=random.randint(5, 25))
            if close_date > today: close_date = today - timedelta(days=1)
            
            cur.execute("""
                INSERT INTO deals (name, amount, stage, close_date, company_id, organization_id, owner, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (f"{c_name} - Project Alpha {month_name}_{w}", amt, 'Closed Won', close_date, c_id, ORG_ID, OWNER_NAME, close_date - timedelta(days=45)))

    # 4. Add Open Deals for the Pipeline (Now and Future)
    for i in range(15):
        amt = random.randint(20000, 150000)
        stage = random.choice(["Qualified to Buy", "Presentation Scheduled", "Decision Maker Bought-In", "Contract Sent"])
        c_id = random.choice(comp_ids)
        cur.execute("SELECT name FROM companies WHERE id = %s", (c_id,))
        c_name = cur.fetchone()[0]
        
        create_date = today - timedelta(days=random.randint(5, 40))
        close_date = today + timedelta(days=random.randint(10, 60)) 
        
        demo = (stage in ["Presentation Scheduled", "Decision Maker Bought-In", "Contract Sent"])
        champion = (stage in ["Decision Maker Bought-In", "Contract Sent"])
        lsn = {"Qualified to Buy": 2, "Presentation Scheduled": 3, "Decision Maker Bought-In": 4, "Contract Sent": 5}[stage]
        
        cur.execute("""
            INSERT INTO deals (name, amount, stage, close_date, company_id, organization_id, owner, demo_completed, champion_identified, last_stage_num, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (f"{c_name} - Ongoing Strategy {i}", amt, stage, close_date, c_id, ORG_ID, OWNER_NAME, demo, champion, lsn, create_date))
        d_id = cur.fetchone()[0]
        for t in range(random.randint(2, 8)):
             cur.execute("INSERT INTO tasks (title, status, deal_id, organization_id) VALUES (%s, %s, %s, %s)", (f"Task_{t}", "Completed", d_id, ORG_ID))
        try:
            r = requests.post(f"{PYTHON_API_URL}/predict", json={"amount": float(amt), "stage": stage, "note_count": 5, "deal_age": (today-create_date).days, "demo_completed": demo, "champion_identified": champion, "days_to_close": (close_date-today).days}, timeout=10)
            if r.ok: cur.execute("UPDATE deals SET ai_score = %s WHERE id = %s", (r.json()["ai_score"], d_id))
        except: pass

    conn.commit()
    print("✅ REBUILD PURE. 5 months history, including Feb. No future wins.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    rebuild()
