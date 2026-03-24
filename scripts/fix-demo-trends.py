import psycopg2
import os
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

def fix_trends():
    print(f"--- 📈 Adding Historical Revenue to fix +100% trend for Org {ORG_ID} ---")
    
    # 1. Add 3 'Closed Won' deals in the PREVIOUS month
    today = datetime.now()
    last_month_start = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    
    # We want last month to have roughly 150k or so if current month has ~300k
    deals = [
        ("NexaTech - Legacy Infrastructure Upgrade", 85000, last_month_start + timedelta(days=10)),
        ("GreenGrid - Q1 Audit Renewal", 45000, last_month_start + timedelta(days=15)),
        ("HealthPulse - Pilot Completion", 120000, last_month_start + timedelta(days=20))
    ]
    
    # Just grab an existing company from Org 11
    cur.execute("SELECT id FROM companies WHERE organization_id = %s LIMIT 1", (ORG_ID,))
    comp_id = cur.fetchone()[0]
    
    for name, amt, cdate in deals:
        cur.execute("""
            INSERT INTO deals (name, amount, stage, close_date, company_id, organization_id, owner, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (name, amt, 'Closed Won', cdate, comp_id, ORG_ID, 'Rahul Sharma', cdate - timedelta(days=30)))
    
    # 2. Add some "Last Month" contacts to fix that trend too
    contacts = [
        ("Michael", "Scott", "m.scott@dundermifflin.com", last_month_start + timedelta(days=5)),
        ("Pam", "Beesly", "pam@dundermifflin.com", last_month_start + timedelta(days=12))
    ]
    for fn, ln, em, cdate in contacts:
        cur.execute("""
            INSERT INTO contacts (first_name, last_name, email, organization_id, created_at)
            VALUES (%s, %s, %s, %s, %s)
        """, (fn, ln, em, ORG_ID, cdate))

    conn.commit()
    print("✅ Historical trends populated. Dashboard should now show organic growth percentages (instead of +100%).")
    cur.close()
    conn.close()

if __name__ == "__main__":
    fix_trends()
