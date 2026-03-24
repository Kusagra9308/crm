import os, psycopg2, dotenv
dotenv.load_dotenv()
url = os.getenv("DATABASE_URL").replace("sslmode=verify-full", "sslmode=require")
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT id FROM deals LIMIT 1")
deal_id = cur.fetchone()[0]
print(f"Testing Update for ID: {deal_id}")
cur.execute("UPDATE deals SET ai_score = 77.7 WHERE id = %s", (deal_id,))
print(f"Rows affected: {cur.rowcount}")
cur.execute("SELECT ai_score FROM deals WHERE id = %s", (deal_id,))
print(f"New score in DB: {cur.fetchone()[0]}")
cur.close()
conn.close()
