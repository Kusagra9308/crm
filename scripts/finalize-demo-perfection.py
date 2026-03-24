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

def finalize():
    print(f"--- 💎 Finalizing Demo Perfection for Org {ORG_ID} ---")

    # 1. Enrich Companies with Indian context and full details
    company_enrichment = {
        "NexaTech Corp": ("https://nexatech.in", "Technology/AI", "5000+", "Bengaluru", "Cloud/Software"),
        "GreenGrid Energy": ("https://greengrid.co.in", "Renewable Energy", "1200", "Hyderabad", "Solar/Grid"),
        "HealthPulse Systems": ("https://healthpulse.in", "Healthcare IT", "850", "Mumbai", "EMR/Diagnostics"),
        "EcoLoom Textiles": ("https://ecoloom.com", "Manufacturing", "3000", "Surat", "Cotton/Apparel"),
        "DataFlow Analytics": ("https://dataflow.ai", "FinTech", "450", "Pune", "Big Data/Fraud")
    }

    for name, (web, ind, emp, city, desc) in company_enrichment.items():
        cur.execute("""
            UPDATE companies 
            SET website = %s, industry = %s, employees = %s, city = %s, description = %s
            WHERE name = %s AND organization_id = %s
        """, (web, ind, emp, city, desc, name, ORG_ID))
    
    # 2. Add Indian Contacts
    indian_contacts = [
        ("Aarav", "Sharma", "aarav@nexatech.in", "Chief Technology Officer"),
        ("Ananya", "Iyer", "ananya@greengrid.co.in", "Sustainability Head"),
        ("Ishaan", "Patel", "ishaan@healthpulse.in", "Director of IT"),
        ("Sanya", "Gupta", "sanya@ecoloom.com", "Operations Lead"),
        ("Kabir", "Mehta", "kabir@dataflow.ai", "Lead Data Scientist"),
        ("Diya", "Chopra", "diya@nexatech.in", "VP Sales"),
        ("Arjun", "Malhotra", "arjun@greengrid.co.in", "Chief Engineer"),
        ("Kiara", "Kaur", "kiara@healthpulse.in", "Compliance Officer"),
        ("Advait", "Desai", "advait@ecoloom.com", "Supply Chain Director"),
        ("Myra", "Singh", "myra@dataflow.ai", "Head of Growth"),
        ("Rohan", "Joshi", "rohan@nexatech.in", "Security Architect"),
        ("Zoya", "Ali", "zoya@greengrid.co.in", "Gov Relations")
    ]
    
    cur.execute("SELECT id, name FROM companies WHERE organization_id = %s", (ORG_ID,))
    comps = cur.fetchall()

    for first, last, email, job in indian_contacts:
        # Match company by email domain
        domain = email.split('@')[1]
        c_id = None
        for cid, cname in comps:
             if domain in cname.lower().replace(" ", "") or domain.split('.')[0] in cname.lower():
                 c_id = cid
                 break
        if not c_id: c_id = random.choice(comps)[0]
        
        cur.execute("""
            INSERT INTO contacts (first_name, last_name, email, job_title, organization_id, company_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (first, last, email, job, ORG_ID, c_id))

    # 3. Rename all tasks to professional titles
    task_titles = [
        "Initial Discovery & Scoping Call",
        "Technical Architecture Review",
        "Send Customized Proposal & Demo Deck",
        "Economic Buyer Alignment Meeting",
        "Security & Compliance Audit",
        "Execute Mutual Action Plan",
        "Procurement & Legal Review",
        "Final Contract Negotiation",
        "Solution Design Workshop",
        "Reference Call with Existing Client",
        "Budgetary Approval Sync",
        "ROI Business Case Presentation"
    ]
    
    cur.execute("SELECT id FROM tasks WHERE organization_id = %s", (ORG_ID,))
    t_ids = [r[0] for r in cur.fetchall()]
    for tid in t_ids:
        cur.execute("UPDATE tasks SET title = %s WHERE id = %s", (random.choice(task_titles), tid))

    conn.commit()
    print("💎 FINISHED. Indian contacts added, tasks renamed, companies enriched.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    finalize()
