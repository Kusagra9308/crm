import joblib
import numpy as np
import warnings
warnings.filterwarnings("ignore")

model = joblib.load("deal_model.pkl")

def score(amount, stage, notes, age, demo, champion, dtc):
    X = np.array([[amount, stage, notes, age, demo, champion, dtc]], dtype=float)
    return round(model.predict_proba(X)[0][1] * 100, 2)

BASE = dict(amount=50000, stage=3, notes=5, age=30, demo=0, champion=0, dtc=15)
baseline = score(**BASE)

print("=" * 60)
print(f"  BASELINE (Stage 3, 5 tasks, no milestones): {baseline}%")
print("=" * 60)

tests = [
    # ── STAGE TESTS (most important after our fix) ──────────────
    ("Stage 1 vs Stage 5",       None, [
        ("Stage 1 — Appointment",    {**BASE, "stage": 1}),
        ("Stage 2 — Qualified",      {**BASE, "stage": 2}),
        ("Stage 3 — Presentation",   {**BASE, "stage": 3}),
        ("Stage 4 — Decision Maker", {**BASE, "stage": 4}),
        ("Stage 5 — Contract Sent",  {**BASE, "stage": 5}),
    ]),

    # ── ACTIVITY TESTS ───────────────────────────────────────────
    ("Activity (note_count)",    None, [
        ("0 tasks",  {**BASE, "notes": 0}),
        ("3 tasks",  {**BASE, "notes": 3}),
        ("5 tasks",  {**BASE, "notes": 5}),
        ("10 tasks", {**BASE, "notes": 10}),
        ("15 tasks", {**BASE, "notes": 15}),
    ]),

    # ── MILESTONE TESTS ──────────────────────────────────────────
    ("Milestones",               None, [
        ("No demo, no champion",        {**BASE, "demo": 0, "champion": 0}),
        ("Champion only",               {**BASE, "demo": 0, "champion": 1}),
        ("Demo only",                   {**BASE, "demo": 1, "champion": 0}),
        ("Demo + Champion",             {**BASE, "demo": 1, "champion": 1}),
    ]),
]

for group_name, _, cases in tests:
    print(f"\n── {group_name} {'─' * (45 - len(group_name))}")
    scores = [score(**kwargs) for _, kwargs in cases]
    for i, (label, kwargs) in enumerate(cases):
        delta = scores[i] - baseline
        arrow = f"+{delta:.1f}" if delta >= 0 else f"{delta:.1f}"
        print(f"  {label:<35} {scores[i]:>6.1f}%   ({arrow})")

print("\n── Critical Assertions ──────────────────────────────────────")

assertions = [
    ("Demo TRUE > Demo FALSE",               score(**{**BASE, "demo": 1}) > score(**{**BASE, "demo": 0})),
    ("Champion TRUE > Champion FALSE",       score(**{**BASE, "champion": 1}) > score(**{**BASE, "champion": 0})),
    ("Stage 5 > Stage 1",                    score(**{**BASE, "stage": 5}) > score(**{**BASE, "stage": 1})),
    ("Best Potential Deal (V8)",             score(200000, 5, 15, 30, 1, 1, 3) > 80),
]

for desc, condition in assertions:
    status = "✅" if condition else "❌"
    print(f"  {status}  {desc:<40} {score(200000, 5, 15, 30, 1, 1, 3) if 'Best' in desc else ''}")
