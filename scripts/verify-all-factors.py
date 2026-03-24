import json
import urllib.request

PYTHON_API_URL = "http://localhost:8000"

def post_predict(features):
    data = json.dumps(features).encode("utf-8")
    req = urllib.request.Request(f"{PYTHON_API_URL}/predict", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def run_tests():
    print("--- 🧠 AI Model Factor Sensitivity Report ---\n")
    
    base_features = {
        "amount": 15000.0,
        "stage": "Presentation Scheduled",
        "note_count": 2,
        "deal_age": 15,
        "demo_completed": False,
        "champion_identified": False,
        "days_to_close": 20
    }

    def test(label, change):
        feats = base_features.copy()
        feats.update(change)
        score = post_predict(feats)["ai_score"]
        print(f"{label:<30} | {score:>6}%")

    print(f"{'FACTOR TESTED':<30} | {'AI WIN PROB':>6}")
    print("-" * 45)
    
    # 1. Baseline
    test("Baseline (Average Deal)", {})

    # 2. Days To Close (Factor 7)
    test("Overdue Deal (-5 days) ⚠️", {"days_to_close": -5})
    test("Long Term (500 days)", {"days_to_close": 500})
    test("Closing Soon (1 day)", {"days_to_close": 1})

    # 3. Amount effect
    test("Big Deal (10M INR)", {"amount": 10000000.0})
    test("Small Deal (10k INR)", {"amount": 10000.0})

    # 4. Stage effect
    test("Stage: Appointment Scheduled", {"stage": "Appointment Scheduled"})
    test("Stage: Contract Sent", {"stage": "Contract Sent"})

    # 5. Activity Density
    test("No Activities (0 notes)", {"note_count": 0})
    test("High Engagement (20 notes)", {"note_count": 20})

    # 6. Deal Age (Momentum)
    test("Fresh Deal (1 day old)", {"deal_age": 1})
    test("Stale Deal (180 days old)", {"deal_age": 180})

    # 7. Product Demo (Crucial Signal)
    test("Demo NOT Completed", {"demo_completed": False})
    test("Demo COMPLETED ✅", {"demo_completed": True})

    # 8. Champion identificado
    test("No Champion identified", {"champion_identified": False})
    test("Champion identified ✅", {"champion_identified": True})

    # 9. All signals GREEN
    test("ALL SIGNALS GREEN 🏆", {
        "stage": "Contract Sent",
        "note_count": 15,
        "deal_age": 5,
        "demo_completed": True,
        "champion_identified": True,
        "days_to_close": 1
    })

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"Error checking API: {e}")
