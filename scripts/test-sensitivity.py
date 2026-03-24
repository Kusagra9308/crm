import os
import psycopg2
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
PYTHON_API_URL = "http://localhost:8000"

def get_connection():
    # Use require instead of verify-full to avoid local CA certificate issues
    url = DATABASE_URL.replace("sslmode=verify-full", "sslmode=require")
    return psycopg2.connect(url)

def post_predict(features):
    data = json.dumps(features).encode("utf-8")
    req = urllib.request.Request(f"{PYTHON_API_URL}/predict", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def test_flow():
    # TEST with significant data change
    features = {
        "amount": 50000.0,
        "stage": "Qualified to Buy",
        "note_count": 0,
        "deal_age": 5,
        "demo_completed": False,
        "champion_identified": False
    }
    
    initial = post_predict(features)
    print(f"Prob with 0 notes: {initial['ai_score']}%")
    
    features["note_count"] = 15 # Huge engagement
    after = post_predict(features)
    print(f"Prob with 15 notes: {after['ai_score']}%")

if __name__ == "__main__":
    test_flow()
