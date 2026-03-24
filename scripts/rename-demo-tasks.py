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

task_titles = [
    "Initial Discovery Call",
    "Technical Requirements Deep-dive",
    "Schedule Product Demonstration",
    "Draft Enterprise Proposal",
    "Champion Alignment Sync",
    "Legal & Compliance Review",
    "Final Pricing Negotiation",
    "Executive Stakeholder Briefing",
    "Post-Demo Feedback Gathering",
    "Security Questionnaire Processing",
    "Customer Reference Verification",
    "Contract Signature Follow-up",
    "Implementation Scope Definition",
    "Strategic ROI Presentation",
    "Budget Approval Confirmation",
    "Custom Sales Deck Preparation",
    "Competitor Gap Analysis",
    "Decision Maker Intro Meeting",
    "Service Level Agreement Draft",
    "Onboarding Roadmap Discussion",
    "IT Infrastructure Assessment",
    "Procurement Process Kick-off",
    "Modernization Strategy Workshop",
    "Cloud Architecture Validation",
    "Project Timeline Agreement"
]

def rename_tasks():
    print(f"--- 📝 Renaming Tasks for Org {ORG_ID} to Professional Titles ---")

    # 1. Fetch all tasks for Org 11
    cur.execute("SELECT id FROM tasks WHERE organization_id = %s", (ORG_ID,))
    task_ids = [r[0] for r in cur.fetchall()]
    
    count = 0
    for tid in task_ids:
        new_title = random.choice(task_titles)
        cur.execute("UPDATE tasks SET title = %s WHERE id = %s", (new_title, tid))
        count += 1

    conn.commit()
    print(f"✅ Renamed {count} tasks successfully.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    rename_tasks()
