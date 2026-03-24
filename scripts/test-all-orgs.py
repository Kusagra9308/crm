import os, psycopg2, dotenv
dotenv.load_dotenv()
url = os.getenv("DATABASE_URL").replace("sslmode=verify-full", "sslmode=require")
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("SELECT organization_id, COUNT(*) as total, COUNT(ai_score) as with_score FROM deals GROUP BY organization_id")
print("ORG SCORES:", cur.fetchall())
cur.close()
conn.close()
