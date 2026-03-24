import joblib
import numpy as np
import warnings
warnings.filterwarnings("ignore")

model = joblib.load("deal_model.pkl")

def score(amount, stage, notes, age, demo, champion, dtc):
    X = np.array([[amount, stage, notes, age, demo, champion, dtc]], dtype=float)
    return round(model.predict_proba(X)[0][1] * 100, 2)

BASE = dict(amount=50000, stage=3, notes=5, age=30, demo=0, champion=0, dtc=15)

assertions = [
    ("Demo TRUE > Demo FALSE",               score(**{**BASE, "demo": 1}) > score(**{**BASE, "demo": 0})),
    ("Champion TRUE > Champion FALSE",       score(**{**BASE, "champion": 1}) > score(**{**BASE, "champion": 0})),
    ("Stage 5 > Stage 1",                    score(**{**BASE, "stage": 5}) > score(**{**BASE, "stage": 1})),
    ("Stage 5 gap > 20%",                    score(**{**BASE, "stage": 5}) - score(**{**BASE, "stage": 1}) > 20),
    ("15 tasks > 0 tasks",                   score(**{**BASE, "notes": 15}) > score(**{**BASE, "notes": 0})),
    ("Best > 80%",                           score(200000, 5, 15, 30, 1, 1, 3) > 80),
    ("Worst < 20%",                          score(5000, 1, 0, 180, 0, 0, -30) < 20),
    ("Stage 5+tasks > Stage 1+tasks",        score(50000, 5, 10, 30, 0, 0, 15) > score(50000, 1, 10, 30, 0, 0, 15)),
]

for desc, condition in assertions:
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {desc}")
    if not condition:
        # Print actual values if failed
        if "gap" in desc:
            print(f"  Actual Gap: {score(**{**BASE, 'stage': 5}) - score(**{**BASE, 'stage': 1}):.2f}")
        elif "Best" in desc:
            print(f"  Actual Best: {score(200000, 5, 15, 30, 1, 1, 3):.2f}")
        elif "Worst" in desc:
            print(f"  Actual Worst: {score(5000, 1, 0, 180, 0, 0, -30):.2f}")
print("--- FINISHED ---")
