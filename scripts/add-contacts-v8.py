import psycopg2
import os
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

def add_contacts():
    print(f"--- 👤 Adding Contacts for Org {ORG_ID} ---")

    # 1. Fetch Companies for Org 11
    cur.execute("SELECT id, name FROM companies WHERE organization_id = %s", (ORG_ID,))
    companies = cur.fetchall()
    
    # 2. Diverse Contact Data
    contact_pool = [
        ("Alice", "Vance", "v.alice@nexatech.com", "VP of Engineering"),
        ("Bob", "Higgins", "bhiggins@greengrid.org", "Sustainability Director"),
        ("Catherine", "Joy", "cjoy@healthpulse.io", "Chief Medical Officer"),
        ("David", "Sloan", "dsloan@ecoloom.biz", "Supply Chain Lead"),
        ("Elena", "Kaur", "ekaur@dataflow.ai", "Head of AI Operations"),
        ("Frank", "Miller", "fmiller@nexatech.com", "Infrastructure Architect"),
        ("Grace", "Lin", "glin@greengrid.org", "Renewable Energy Strategist"),
        ("Henry", "Foster", "hfoster@healthpulse.io", "Clinical Product Manager"),
        ("Iris", "Patel", "ipatel@ecoloom.biz", "Digital Transformation Head"),
        ("James", "Rodriguez", "jrodriguez@dataflow.ai", "Senior Data Scientist"),
        ("Karen", "T", "karen@nexatech.com", "IT Procurement"),
        ("Leo", "G", "leo@greengrid.org", "Field Operations Manager")
    ]
    
    stages = ["Lead", "Marketing Qualified Lead", "Sales Qualified Lead", "Customer", "Other"]
    
    count = 0
    for first, last, email, job in contact_pool:
        # Link to a company based on domain if possible, else random
        comp_id = None
        for cid, cname in companies:
            if cname.lower().split()[0] in email.lower():
                comp_id = cid
                break
        if not comp_id:
            comp_id = random.choice(companies)[0]
            
        cur.execute("""
            INSERT INTO contacts (first_name, last_name, email, job_title, lifecycle_stage, company_id, organization_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            first, last, email, job, random.choice(stages), comp_id, ORG_ID
        ))
        count += 1

    conn.commit()
    print(f"✅ Added {count} contacts successfully.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    add_contacts()
