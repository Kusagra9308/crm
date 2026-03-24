import joblib
import numpy as np

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
    # Each higher stage must score higher than the one before
    ("Stage 1 vs Stage 5",       None, [
        ("Stage 1 — Appointment",    {**BASE, "stage": 1}),
        ("Stage 2 — Qualified",      {**BASE, "stage": 2}),
        ("Stage 3 — Presentation",   {**BASE, "stage": 3}),
        ("Stage 4 — Decision Maker", {**BASE, "stage": 4}),
        ("Stage 5 — Contract Sent",  {**BASE, "stage": 5}),
    ]),

    # ── ACTIVITY TESTS ───────────────────────────────────────────
    # More tasks = higher score, always
    ("Activity (note_count)",    None, [
        ("0 tasks",  {**BASE, "notes": 0}),
        ("3 tasks",  {**BASE, "notes": 3}),
        ("5 tasks",  {**BASE, "notes": 5}),
        ("10 tasks", {**BASE, "notes": 10}),
        ("15 tasks", {**BASE, "notes": 15}),
    ]),

    # ── MILESTONE TESTS ──────────────────────────────────────────
    # demo/champion must ALWAYS push score UP independently
    ("Milestones",               None, [
        ("No demo, no champion",        {**BASE, "demo": 0, "champion": 0}),
        ("Champion only",               {**BASE, "demo": 0, "champion": 1}),
        ("Demo only",                   {**BASE, "demo": 1, "champion": 0}),
        ("Demo + Champion",             {**BASE, "demo": 1, "champion": 1}),
    ]),

    # ── STAGE GATING TEST ────────────────────────────────────────
    # Key insight: same 10 tasks should mean MORE at Stage 5 than Stage 1
    ("Stage gating (same tasks, diff stage)", None, [
        ("Stage 1 + 10 tasks", {"amount": 50000, "stage": 1, "notes": 10, "age": 30, "demo": 0, "champion": 0, "dtc": 15}),
        ("Stage 3 + 10 tasks", {"amount": 50000, "stage": 3, "notes": 10, "age": 30, "demo": 0, "champion": 0, "dtc": 15}),
        ("Stage 5 + 10 tasks", {"amount": 50000, "stage": 5, "notes": 10, "age": 30, "demo": 0, "champion": 0, "dtc": 15}),
    ]),

    # ── DAYS TO CLOSE ────────────────────────────────────────────
    ("Days to close",            None, [
        ("Overdue -30 days",  {**BASE, "dtc": -30}),
        ("Overdue -5 days",   {**BASE, "dtc": -5}),
        ("Due today",         {**BASE, "dtc":  0}),
        ("Closing in 15d",    {**BASE, "dtc": 15}),
        ("Far out 90d",       {**BASE, "dtc": 90}),
    ]),

    # ── EXTREME CASES ────────────────────────────────────────────
    ("Extreme cases",            None, [
        ("💀 Worst possible", {"amount":   5000, "stage": 1, "notes":  0, "age": 180, "demo": 0, "champion": 0, "dtc": -30}),
        ("🏆 Best possible",  {"amount": 200000, "stage": 5, "notes": 15, "age":  30, "demo": 1, "champion": 1, "dtc":   3}),
    ]),
]

all_passed = True

for group_name, _, cases in tests:
    print(f"\n── {group_name} {'─' * (45 - len(group_name))}")
    scores = [score(**kwargs) for _, kwargs in cases]

    for i, (label, kwargs) in enumerate(cases):
        delta = scores[i] - baseline
        arrow = f"+{delta:.1f}" if delta >= 0 else f"{delta:.1f}"
        print(f"  {label:<35} {scores[i]:>6.1f}%   ({arrow})")

    # Check each group is monotonically increasing
    is_monotonic = all(scores[i] < scores[i+1] for i in range(len(scores)-1))
    status = "✅ Increasing correctly" if is_monotonic else "❌ NOT monotonic — inversion detected"
    if not is_monotonic:
        all_passed = False
    print(f"  → {status}")

# ── Critical individual assertions ───────────────────────────
print("\n── Critical Assertions ──────────────────────────────────────")

assertions = [
    # (description,                          condition,                                         what we expect)
    ("Demo TRUE > Demo FALSE",               score(**{**BASE, "demo": 1}) > score(**{**BASE, "demo": 0}),            "demo=1 scores higher"),
    ("Champion TRUE > Champion FALSE",       score(**{**BASE, "champion": 1}) > score(**{**BASE, "champion": 0}),    "champion=1 scores higher"),
    ("Stage 5 > Stage 1",                    score(**{**BASE, "stage": 5}) > score(**{**BASE, "stage": 1}),          "stage 5 beats stage 1"),
    ("Stage 5 gap > 20%",                    score(**{**BASE, "stage": 5}) - score(**{**BASE, "stage": 1}) > 20,     "stage swing > 20%"),
    ("15 tasks > 0 tasks",                   score(**{**BASE, "notes": 15}) > score(**{**BASE, "notes": 0}),         "more tasks = higher score"),
    ("Best > 80%",                           score(200000, 5, 15, 30, 1, 1, 3) > 80,                                 "best deal scores > 80%"),
    ("Worst < 20%",                          score(5000, 1, 0, 180, 0, 0, -30) < 20,                                 "worst deal scores < 20%"),
    ("Stage 5+tasks > Stage 1+tasks",        score(50000, 5, 10, 30, 0, 0, 15) > score(50000, 1, 10, 30, 0, 0, 15), "gating works"),
]

for desc, condition, expectation in assertions:
    status = "✅" if condition else "❌ FAIL"
    if not condition:
        all_passed = False
    print(f"  {status}  {desc:<40} ({expectation})")

print("\n" + "=" * 60)
print(f"  {'✅ ALL TESTS PASSED — model behaving as intended' if all_passed else '❌ FAILURES DETECTED — check inversions above'}")
print("=" * 60)
