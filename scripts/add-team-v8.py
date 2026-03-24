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

def add_team():
    print(f"--- 👥 Adding Team Members for Org {ORG_ID} ---")
    
    # 1. Create Active Members
    hashed_pw = bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    members = [
        ("Sarah Jenkins", "s.jenkins@salesforce.com"),
        ("Michael Rivera", "m.rivera@salesforce.com"),
        ("Emily Chen", "e.chen@salesforce.com")
    ]
    
    for name, email in members:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO users (name, email, password, organization_id)
                VALUES (%s, %s, %s, %s)
            """, (name, email, hashed_pw, ORG_ID))
            print(f"✅ Added Active Member: {name}")

    # 2. Add Pending Invitations
    invites = [
        ("David Smith", "d.smith@salesforce.com"),
        ("Jessica Wu", "j.wu@salesforce.com")
    ]
    for name, email in invites:
        cur.execute("SELECT id FROM invitations WHERE email = %s", (email,))
        if not cur.fetchone():
            token = "tk_" + "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=15))
            cur.execute("""
                INSERT INTO invitations (email, organization_id, token, status)
                VALUES (%s, %s, %s, %s)
            """, (email, ORG_ID, token, 'Pending'))
            print(f"✅ Added Pending Invitation for: {name}")

    conn.commit()
    cur.close()
    conn.close()

if __name__ == "__main__":
    add_team()
