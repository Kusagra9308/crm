import os
import joblib
import numpy as np
import itertools
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
MODEL_PATH = "deal_model.pkl"

def stress_test():
    print("--- 🧠 AI Logic Stress Test (128 Combinations) ---")
    if not os.path.exists(MODEL_PATH):
        print("Model not found. Run ml_pipeline.py first.")
        return
    
    model = joblib.load(MODEL_PATH)
    
    # Define Factor Ranges
    factors = {
        "amount": [15000.0, 50000.0],
        "stage_num": [1, 5],
        "note_count": [0, 15],
        "deal_age": [5, 90],
        "demo": [0, 1],
        "champion": [0, 1],
        "dtc": [-5, 30]
    }
    
    # Generate all combinations (2^7 = 128)
    keys = list(factors.keys())
    combinations = list(itertools.product(*[factors[k] for k in keys]))
    
    results = []
    for combo in combinations:
        # Match order: [amount, stage_num, float(nc), float(age), float(demo), float(champion), float(dtc)]
        features = np.array([combo], dtype=float)
        score = model.predict_proba(features)[0][1] * 100
        results.append({**dict(zip(keys, combo)), "score": round(score, 2)})
    
    df = pd.DataFrame(results)
    
    # 🔍 Logical Checks for 128 Permutations
    print("\n🧐 Probing for Reasoning Faults...")
    
    # Check if a Demo EVER lowers the score (Inversion check)
    inversions = 0
    for i in range(len(df)):
        if df.iloc[i]['demo'] == 1:
            # Find its counterpart with demo=0
            match = df[(df['amount'] == df.iloc[i]['amount']) & 
                       (df['stage_num'] == df.iloc[i]['stage_num']) & 
                       (df['note_count'] == df.iloc[i]['note_count']) & 
                       (df['deal_age'] == df.iloc[i]['deal_age']) & 
                       (df['champion'] == df.iloc[i]['champion']) & 
                       (df['dtc'] == df.iloc[i]['dtc']) & 
                       (df['demo'] == 0)]
            if not match.empty:
                if df.iloc[i]['score'] < match.iloc[0]['score']:
                    # Special error: Milestone dropped score
                    inversions += 1

    print(f"Logic Audit Result: {inversions} Inversions (Failures) out of 64 milestone pair tests.")
    if inversions == 0:
        print("✅ The AI logic is 100% PERFECT across all permutations.")
    else:
        print(f"⚠️ Warning: Found {inversions} illogical inversions. Model needs more data tuning.")

    # 📊 Correlation Analysis
    corr = df.corr()["score"].sort_values(ascending=False)
    print("\nPredictive Significance of Factors:")
    for k, v in corr.items():
        if k != "score":
            print(f" - {k:<15}: {v:>6.2f}")
    
    print("\n--- Summary Performance ---")
    print(f"Min Score (Coldest) : {df['score'].min()}%")
    print(f"Max Score (Hottest) : {df['score'].max()}%")
    print(f"Median Score        : {df['score'].median()}%")
    
    # Sample logic verification (Common scenarios)
    print("\n--- Proof of Sensitivity (Sample Scenarios) ---")
    # Low Activity vs High Activity (with everything else constant)
    sample_low = df[(df["amount"]==15000) & (df["stage_num"]==1) & (df["note_count"]==0) & (df["demo"]==0) & (df["dtc"]==30)]["score"].mean()
    sample_high = df[(df["amount"]==15000) & (df["stage_num"]==1) & (df["note_count"]==15) & (df["demo"]==0) & (df["dtc"]==30)]["score"].mean()
    print(f"Baseline (0 tasks) -> Activity (15 tasks): {sample_low}% -> {sample_high}%")

    demo_low = df[(df["amount"]==15000) & (df["stage_num"]==1) & (df["note_count"]==0) & (df["demo"]==0) & (df["dtc"]==30)]["score"].mean()
    demo_high = df[(df["amount"]==15000) & (df["stage_num"]==1) & (df["note_count"]==0) & (df["demo"]==1) & (df["dtc"]==30)]["score"].mean()
    print(f"No Demo -> Demo Completed (at 0 tasks): {demo_low}% -> {demo_high}%")

    overdue_low = df[(df["dtc"]==30)]["score"].mean()
    overdue_high = df[(df["dtc"]==-5)]["score"].mean()
    print(f"Avg Deal (30d left) -> Avg Deal Overdue (-5d): {overdue_low:.2f}% -> {overdue_high:.2f}%")

if __name__ == "__main__":
    stress_test()
