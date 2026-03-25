import os
import random
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"), override=True)
DATABASE_URL = os.getenv("DATABASE_URL")
ORG_ID = 11

STAGE_NAMES = ["Appointment Scheduled", "Qualified to Buy", "Presentation Scheduled", "Decision Maker Bought-In", "Contract Sent"]
REALISTIC_TASKS = ["Initial Discovery Call", "Follow-up Email Sent", "Technical Requirements Review", "Solution Presentation", "Architecture Workshop", "Budget Approval Meeting", "Security Questionnaire Review", "Contract Redlining", "Implementation Planning", "Customer Success Intro", "Final Negotiation", "Internal Champion Sync"]
DEAL_NAMES = ["Enterprise Cloud Migration", "Digital Transformation - Phase II", "Security Infrastructure Refresh", "Data Analytics Platform Upgrade", "Unified Communication Rollout", "Managed Services Partnership", "Edge Computing Deployment", "AI/ML Integration Project", "Global Network Expansion", "Customer Experience Platform", "Supply Chain Optimization", "Hybrid Cloud Storage Expansion", "IoT Device Prototyping", "Compliance & Risk Management Suite", "E-commerce Engine Rebuild"]
CONTACT_FIRST = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Ishaan", "Rudra", "Aryan", "Ananya", "Saanvi", "Aavya", "Diya", "Anika"]
CONTACT_LAST = ["Sharma", "Verma", "Gupta", "Malhotra", "Kapoor", "Joshi", "Patel", "Reddy", "Iyer"]

def get_connection():
    return psycopg2.connect(DATABASE_URL.replace("sslmode=verify-full", "sslmode=require"))

def run():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM tasks WHERE organization_id = %s", (ORG_ID,))
    cur.execute("DELETE FROM contacts WHERE organization_id = %s", (ORG_ID,))
    cur.execute("DELETE FROM deals WHERE organization_id = %s", (ORG_ID,))

    # 1. Contacts (15) - Shared between Feb and March
    vals = []
    for i in range(15):
        days_ago = random.randint(2, 45) # Feb or March
        vals.append((random.choice(CONTACT_FIRST), random.choice(CONTACT_LAST), f"c{i}@sharma.com", "Director", ORG_ID, datetime.now()-timedelta(days=days_ago)))
    execute_values(cur, "INSERT INTO contacts (first_name, last_name, email, job_title, organization_id, created_at) VALUES %s", vals)

    # 2. Historical (Feb/March)
    # 2 Feb Wins (m=1), 2 March Wins (m=0), 6 Stale Wins (m=2,3)
    h_deals = []
    # Current Month (March)
    for _ in range(2):
        cd = datetime.now() - timedelta(days=random.randint(1, 10))
        h_deals.append(("Current Project", random.randint(110000,150000), "Closed Won", "Alice Freeman", cd, 1, ORG_ID, True, True, 95.0, 5, cd-timedelta(days=30), True))
    
    # Last Month (February)
    for _ in range(2):
        cd = datetime.now() - timedelta(days=random.randint(26, 35))
        h_deals.append(("Last Month Project", random.randint(80000,105000), "Closed Won", "Alice Freeman", cd, 1, ORG_ID, True, True, 95.0, 5, cd-timedelta(days=30), True))
    
    # Dec/Jan (Older charts)
    for _ in range(6):
        cd = datetime.now() - timedelta(days=random.randint(60, 100))
        h_deals.append(("Older Win", random.randint(50000, 120000), "Closed Won", "Alice Freeman", cd, 1, ORG_ID, True, True, 95.0, 5, cd-timedelta(days=30), True))
    for _ in range(5):
        cd = datetime.now() - timedelta(days=20)
        h_deals.append(("Lost Project", 50000, "Closed Lost", "Alice Freeman", cd, 1, ORG_ID, True, False, 5.0, 2, cd-timedelta(days=30), True))

    # 3. Open (30) - 8 High, 15 Medium, 7 Low
    pats = [("High",4,5,True,True,10,15,5,20,85,95)]*8 + [("Medium",2,3,True,False,4,6,20,45,45,65)]*15 + [("Low",1,1,False,False,0,0,90,150,12,25)]*7
    
    o_deals = []
    for i, (l, min_s, max_s, demo, champ, min_t, max_t, min_a, max_a, min_sc, max_sc) in enumerate(pats):
        st_n = random.randint(min_s, max_s)
        cd = datetime.now() + timedelta(days=random.randint(20,60))
        cr = datetime.now() - timedelta(days=random.randint(min_a, max_a))
        o_deals.append({
            "val": (f"{random.choice(DEAL_NAMES)} - {l} {i}", random.randint(30000,100000), STAGE_NAMES[st_n-1], "Alice Freeman", cd, 1, ORG_ID, demo, champ, random.uniform(min_sc, max_sc), st_n, cr, True),
            "nt": random.randint(min_t, max_t)
        })

    all_vals = h_deals + [d["val"] for d in o_deals]
    inserted = execute_values(cur, "INSERT INTO deals (name, amount, stage, owner, close_date, company_id, organization_id, demo_completed, champion_identified, ai_score, last_stage_num, created_at, is_synthetic) VALUES %s RETURNING id, name", all_vals, fetch=True)
    
    d_map = {name: i for i, name in inserted}
    t_vals = []
    for od in o_deals:
        d_id = d_map.get(od["val"][0])
        if d_id:
            for t in random.sample(REALISTIC_TASKS, min(od["nt"], len(REALISTIC_TASKS))):
                t_vals.append((t, "Verified", "Completed", d_id, ORG_ID, datetime.now()))
    
    if t_vals:
        execute_values(cur, "INSERT INTO tasks (title, description, status, deal_id, organization_id, due_date) VALUES %s", t_vals)

    conn.commit()
    conn.close()
    print("✅ Full Reset & Distribution Calibration Complete.")

if __name__ == "__main__":
    run()
