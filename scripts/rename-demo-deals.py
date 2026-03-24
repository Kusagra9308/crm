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

project_names = [
    "Enterprise Cloud Migration",
    "Annual Subscription Renewal",
    "Security Suite Upgrade",
    "Q1 Growth Partnership",
    "Infrastructure Modernization",
    "Managed IT Services",
    "Data Analytics Platform",
    "Global Support Package",
    "Professional Training Program",
    "Hardware Refresh 2024",
    "AI Strategy Consultation",
    "Software Development Outsourcing",
    "Customer Success Workshop",
    "Legacy System Integration",
    "Digital Transformation Audit",
    "Identity Management Setup",
    "DevOps Automation Plan",
    "Cloud Compliance Review",
    "ERP Implementation Phase 1",
    "Network Security Maintenance",
    "API Integration Initiative",
    "SaaS Platform Migration",
    "Backup & Recovery Setup",
    "Database Performance Tuning",
    "Workflow Optimization Audit",
    "Strategic Account Review",
    "Premium Support Bundle",
    "IoT Infrastructure Pilot",
    "Cyber Risk Assessment",
    "Modern Workspace Rollout"
]

def rename_deals():
    print(f"--- 🏷️ Renaming Deals for Org {ORG_ID} to Professional Titles ---")

    # 1. Fetch Deals and Company names for Org 11
    cur.execute("""
        SELECT d.id, c.name FROM deals d 
        JOIN companies c ON d.company_id = c.id 
        WHERE d.organization_id = %s
    """, (ORG_ID,))
    deals = cur.fetchall()
    
    random.shuffle(project_names)
    
    count = 0
    for i, (deal_id, company_name) in enumerate(deals):
        # Format: Company Name - Project Name
        if i < len(project_names):
            p_name = project_names[i]
        else:
            p_name = f"Strategic Project {i+1}"
            
        full_name = f"{company_name} - {p_name}"
        
        cur.execute("UPDATE deals SET name = %s WHERE id = %s", (full_name, deal_id))
        count += 1

    conn.commit()
    print(f"✅ Renamed {count} deals successfully.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    rename_deals()
