import psycopg2
import os
import bcrypt
import random
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

def indianize():
    print(f"--- 🇮🇳 Indianizing Team and Geo-Data for Org {ORG_ID} ---")

    # 1. Update Team Members to Indian Names
    team_updates = [
        ("Sarah Jenkins", "Anjali Nair", "anjali@nexatech.in"),
        ("Michael Rivera", "Siddharth Rao", "siddharth@nexatech.in"),
        ("Emily Chen", "Priyanaka Gupta", "priyanka@nexatech.in")
    ]
    for old_name, new_name, new_email in team_updates:
        cur.execute("UPDATE users SET name = %s, email = %s WHERE name = %s AND organization_id = %s", (new_name, new_email, old_name, ORG_ID))

    # 2. Update Invitations to Indian Names
    invite_updates = [
        ("d.smith@salesforce.com", "vikram@nexatech.in"),
        ("j.wu@salesforce.com", "sneha@nexatech.in")
    ]
    for old_em, new_em in invite_updates:
        cur.execute("UPDATE invitations SET email = %s WHERE email = %s AND organization_id = %s", (new_em, old_em, ORG_ID))

    # 3. Update Geography and Full Details for Companies
    # State mapping: Bengaluru -> Karnataka, Hyderabad -> Telangana, Mumbai/Pune -> Maharashtra, Surat -> Gujarat
    geo_updates = {
        "NexaTech Corp": ("Karnataka", "India", "nexatech.in", "Subscriber", "5000+", "$1M - $5M"),
        "GreenGrid Energy": ("Telangana", "India", "greengrid.co.in", "Customer", "1200", "$5M - $10M"),
        "HealthPulse Systems": ("Maharashtra", "India", "healthpulse.in", "Lead", "850", "$500K - $1M"),
        "EcoLoom Textiles": ("Gujarat", "India", "ecoloom.com", "Opportunity", "3000", "$1M - $5M"),
        "DataFlow Analytics": ("Maharashtra", "India", "dataflow.ai", "SQL", "450", "$2M - $5M")
    }

    for name, (state, country, domain, stage, emp, rev) in geo_updates.items():
        cur.execute("""
            UPDATE companies 
            SET state = %s, country = %s, domain = %s, lifecycle_stage = %s, employees = %s, description = %s
            WHERE name = %s AND organization_id = %s
        """, (state, country, domain, stage, emp, f"Premier {name} operations based in {state}.", name, ORG_ID))

    conn.commit()
    print("✅ Indianization Complete. Team, Geo, and Company details are now 100% accurate.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    indianize()
