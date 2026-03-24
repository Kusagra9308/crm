import os, psycopg2, dotenv
dotenv.load_dotenv()
url = os.getenv("DATABASE_URL").replace("sslmode=verify-full", "sslmode=require")
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("SELECT organization_id, id FROM deals WHERE ai_score IS NOT NULL LIMIT 5")
print("DEALS WITH SCORES:", cur.fetchall())
cur.close()
conn.close()
