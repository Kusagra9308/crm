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

def create_demo_data():
    print(f"--- 🎭 Creating Professor-Ready Demo Data for {OWNER_NAME} (Org {ORG_ID}) ---")

    # 1. Create a few diverse companies for Org 11
    company_data = [
        ("NexaTech Corp", "Technology", "Enterprise", "Bengaluru"),
        ("GreenGrid Energy", "Environment", "Mid-size", "Hyderabad"),
        ("HealthPulse Systems", "Healthcare", "Enterprise", "Mumbai"),
        ("EcoLoom Textiles", "Manufacturing", "Small Business", "Surat"),
        ("DataFlow Analytics", "Technology", "Startup", "Pune")
    ]
    
    comp_ids = []
    for name, ind, size, city in company_data:
        cur.execute(
            "INSERT INTO companies (name, industry, employees, city, organization_id) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (name, ind, size, city, ORG_ID)
        )
        comp_ids.append(cur.fetchone()[0])
    
    conn.commit()
    print(f"✅ Created {len(comp_ids)} companies.")

    # 2. Stage/Win-Probability Map for Variety
    stages = [
        "Appointment Scheduled",
        "Qualified to Buy",
        "Presentation Scheduled",
        "Decision Maker Bought-In",
        "Contract Sent",
        "Closed Won",
        "Closed Lost"
    ]

    # 3. Create 30 Deals across 4 months
    today = datetime.now()
    month_offsets = [-90, -60, -30, 0] # Spread over 4 months
    
    deal_count = 0
    for i in range(30):
        # Variety: Mix of high-value and low-value deals
        amount = random.randint(10000, 300000)
        stage = random.choice(stages)
        comp_id = random.choice(comp_ids)
        
        # Date Variety (Relative to creation)
        creation_date = today + timedelta(days=random.randint(-120, 0))
        close_date = creation_date + timedelta(days=random.randint(30, 120))
        
        # Milestone Logic (Correlate with stage)
        demo = False
        champion = False
        lsn = 1
        
        if stage in ["Presentation Scheduled", "Decision Maker Bought-In", "Contract Sent", "Closed Won"]:
            demo = random.random() < 0.8 # Highly likely to have demo done at these stages
            lsn = random.randint(3, 5)
        if stage in ["Decision Maker Bought-In", "Contract Sent", "Closed Won"]:
            champion = random.random() < 0.7 # Likely buy-in here
            lsn = 4
        if stage == "Contract Sent":
            lsn = 5
            
        cur.execute("""
            INSERT INTO deals (name, amount, stage, close_date, company_id, organization_id, owner, demo_completed, champion_identified, last_stage_num, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            f"Deal_{random.randint(100, 999)}_{i}", 
            amount, 
            stage, 
            close_date, 
            comp_id, 
            ORG_ID, 
            OWNER_NAME, 
            demo, 
            champion,
            lsn,
            creation_date
        ))
        
        deal_id = cur.fetchone()[0]
        
        # 4. Add 0-12 Tasks per deal to feed AI Density
        num_tasks = random.randint(0, 12)
        for t in range(num_tasks):
            t_date = creation_date + timedelta(days=random.randint(0, 30))
            cur.execute("""
                INSERT INTO tasks (title, status, deal_id, organization_id, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                f"CRM Interaction_{t}", 
                "Completed" if t_date < today else "Pending", 
                deal_id, 
                ORG_ID,
                t_date
            ))
            
        # 5. Calculate & Buffer AI Score if not closed
        if stage not in ["Closed Won", "Closed Lost"]:
            try:
                # Calculate age/dtc
                age = (today - creation_date).days
                dtc = (close_date - today).days
                
                res = requests.post(f"{PYTHON_API_URL}/predict", json={
                    "amount": float(amount),
                    "stage": stage,
                    "note_count": num_tasks,
                    "deal_age": age,
                    "demo_completed": demo,
                    "champion_identified": champion,
                    "days_to_close": dtc
                }, timeout=10)
                
                if res.status_code == 200:
                    score = res.json().get("ai_score", 0)
                    cur.execute("UPDATE deals SET ai_score = %s WHERE id = %s", (score, deal_id))
            except Exception as e:
                print(f"⚠️ Failed to score deal {deal_id}: {e}")
                
        deal_count += 1

    conn.commit()
    print(f"🏆 Successfully created {deal_count} varied deals with matching AI scores.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    create_demo_data()
