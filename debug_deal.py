import psycopg2
import os

DATABASE_URL = "postgresql://neondb_owner:npg_LS6clvY4Mswi@ep-patient-glade-amu1nybh-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

name = "EcoLoom Textiles - Ongoing Strategy 13"
cur.execute("""
    SELECT d.id, d.amount, d.stage, d.created_at, d.close_date, d.demo_completed, d.champion_identified,
           (SELECT COUNT(*) FROM tasks t WHERE t.deal_id = d.id) as note_count
    FROM deals d
    WHERE d.name = %s
""", (name,))

res = cur.fetchone()
if res:
    print(f"ID: {res[0]}")
    print(f"Amount: {res[1]}")
    print(f"Stage: {res[2]}")
    print(f"Created At: {res[3]}")
    print(f"Close Date: {res[4]}")
    print(f"Demo: {res[5]}")
    print(f"Champion: {res[6]}")
    print(f"Notes: {res[7]}")
else:
    print("Deal not found")

conn.close()
