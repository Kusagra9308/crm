"""
FastAPI ML Prediction Server
Run with: py -3.11 predict_api.py
Exposes POST /predict -> returns { ai_score: float }
"""

import os
import numpy as np
import joblib
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Load model once at startup ─────────────────────────────────────────────────
# The model is in the root, go up one level from /server
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "deal_model.pkl")
model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print(f"DONE: Model loaded from {MODEL_PATH}")
    else:
        print(f"WARN: No model found at {MODEL_PATH}. Run ml_pipeline.py first.")
    yield  # app runs here

app = FastAPI(title="Deal AI Scoring API", version="1.0.0", lifespan=lifespan)

# Allow all origins for production convenience (Render)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request schema ─────────────────────────────────────────────────────────────
# ── Request schema ─────────────────────────────────────────────────────────────
class DealFeatures(BaseModel):
    amount: float
    stage: str
    note_count: int = 0
    deal_age: int = 0
    demo_completed: bool = False
    champion_identified: bool = False
    days_to_close: int = 0
    company_ai_score: float = 0.5

# Map frontend stage names to model numeric labels
STAGE_MAP = {
    "Appointment Scheduled": 1,
    "Qualified to Buy": 2,
    "Presentation Scheduled": 3,
    "Decision Maker Bought-In": 4,
    "Contract Sent": 5,
    "Closed Won": 5,
    "Closed Lost": 1
}

FEATURE_LABELS = {
    "amount": "Deal size impact",
    "stage_numeric": "Advanced deal stage",
    "note_count": "Engagement activity",
    "deal_age": "Days in pipeline",
    "demo_completed": "Key milestone (Demo)",
    "champion_identified": "Relationship (Champion)",
    "days_to_close": "Timeline proximity",
    "company_score": "Company history quality",
    "stage_demo": "Stage-to-Demo synergy",
    "stage_notes": "Activity-to-Stage synergy",
    "activity_recency": "Recent engagement speed",
    "stalled": "Dead deal signal",
    "late_stage_risk": "Low activity for this stage",
    "milestone_gap": "Missing mandatory milestone"
}

ACTION_RULES = [
    {
        "id": "demo",
        "label": "Schedule and complete a demo",
        "check": lambda d: not d.demo_completed
    },
    {
        "id": "champion",
        "label": "Identify a strong internal champion",
        "check": lambda d: not d.champion_identified
    },
    {
        "id": "activity",
        "label": "Increase engagement (log more notes/calls)",
        "check": lambda d: d.note_count < 5
    },
    {
        "id": "stage",
        "label": "Push to the next pipeline stage",
        "check": lambda d: STAGE_MAP.get(d.stage, 1) < 4
    },
    {
        "id": "close",
        "label": "Set a realistic close date sooner",
        "check": lambda d: d.days_to_close > 45
    }
]

# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health")
@app.head("/health")
def health():
    return Response(content="OK", media_type="text/plain")

# ── Predict endpoint ───────────────────────────────────────────────────────────
@app.post("/predict")
def predict(deal: DealFeatures):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please run ml_pipeline.py first."
        )

    # If deal is already closed, return hard logic (100 or 0)
    if deal.stage == "Closed Won":
        return {"ai_score": 100.0}
    if deal.stage == "Closed Lost":
        return {"ai_score": 0.0}

    # Map frontend stage names to model numeric labels
    stage_num = STAGE_MAP.get(deal.stage, 1)

    # Apply transformations (Same as training)
    amt_norm = float(deal.amount) / 200000.0
    age_norm = np.clip(float(deal.deal_age), 0, 180) / 180.0
    dtc_norm = np.clip(float(deal.days_to_close), -180, 180) / 180.0
    st_norm  = float(stage_num) / 5.0
    
    nc_log   = np.log1p(float(deal.note_count))
    demo_f   = float(1 if deal.demo_completed else 0)
    
    # Interaction & Derived features
    sd    = st_norm * demo_f
    sn_nc = st_norm * nc_log
    rec   = nc_log / (age_norm + 1.0)
    stall = 1.0 if (float(deal.note_count) == 0 and float(deal.deal_age) > 30) else 0.0

    # Audit Features
    ls_risk = 1.0 if (stage_num >= 4 and float(deal.note_count) < 5) else 0.0
    m_gap   = 1.0 if (stage_num >= 3 and not deal.demo_completed) else 0.0

    # Order must match ml_pipeline features:
    features = np.array([[
        amt_norm,
        nc_log,
        age_norm,
        demo_f,
        float(1 if deal.champion_identified else 0),
        dtc_norm,
        float(deal.company_ai_score),
        sd,
        sn_nc,
        (nc_log + 0.1) / (age_norm + 1.0),
        stall,
        ls_risk,
        m_gap
    ]], dtype=float)

    score = float(round(model.predict_proba(features)[0][1] * 100, 2))
    
    # --- V8 Aggressive Safety Net ---
    # If it's a 'Perfect Setup' deal, ensure it has a high floor for the demo
    if deal.stage == "Contract Sent" and deal.demo_completed and deal.champion_identified:
        score = max(score, 88.0)
        
    return {"ai_score": score}

@app.post("/explain")
def explain(deal: DealFeatures):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # 1. Get Score
    prediction = predict(deal)
    score = prediction["ai_score"]

    # 2. Extract Coefficients (Peeking into Calibrated model)
    try:
        # model is a Pipeline with ("scaler", StandardScaler) and ("clf", CalibratedClassifierCV)
        calibrated_model = model.named_steps["clf"]
        
        # Scikit-learn nested structure for calibrated objects
        # In newer versions (since 1.2+), the fitted estimator is .estimator
        # In very old versions, it was .base_estimator
        internal_calib = calibrated_model.calibrated_classifiers_[0]
        
        base_lr = None
        if hasattr(internal_calib, "estimator"):
            base_lr = internal_calib.estimator
        elif hasattr(internal_calib, "base_estimator"):
            base_lr = internal_calib.base_estimator
            
        if base_lr is None or not hasattr(base_lr, "coef_"):
            raise ValueError("Internal estimator coefficients not accessible")
            
        coefs = base_lr.coef_[0]
    except Exception as e:
        import traceback
        print(f"Explanation Error: {e}")
        # traceback.print_exc()
        return {
            "score": score,
            "why": ["Analysis currently unavailable for this model architecture"],
            "next_actions": []
        }

    # 3. Build Feature Vector (Manual Scaling)
    stage_num = STAGE_MAP.get(deal.stage, 1)
    amt_norm = float(deal.amount) / 200000.0
    age_norm = np.clip(float(deal.deal_age), 0, 180) / 180.0
    dtc_norm = np.clip(float(deal.days_to_close), -180, 180) / 180.0
    st_norm  = float(stage_num) / 5.0
    nc_log   = np.log1p(float(deal.note_count))
    demo_f   = float(1 if deal.demo_completed else 0)
    
    sd    = st_norm * demo_f
    sn_nc = st_norm * nc_log
    rec   = nc_log / (age_norm + 1.0)
    stall = 1.0 if (float(deal.note_count) == 0 and float(deal.deal_age) > 30) else 0.0
    
    ls_risk = 1.0 if (stage_num >= 4 and float(deal.note_count) < 5) else 0.0
    m_gap   = 1.0 if (stage_num >= 3 and not deal.demo_completed) else 0.0

    final_vector = [
        amt_norm, nc_log, age_norm, demo_f, 
        float(1 if deal.champion_identified else 0), 
        dtc_norm, 
        float(deal.company_ai_score),
        sd, sn_nc, (nc_log + 0.1) / (age_norm + 1.0), stall, ls_risk, m_gap
    ]

    # 4. Compute Contributions (Score Impact)
    feature_names = [
        "amount", "note_count", "deal_age", "demo_completed",
        "champion_identified", "days_to_close", "company_score", "stage_demo", "stage_notes", 
        "activity_recency", "stalled", "late_stage_risk", "milestone_gap"
    ]
    
    impacts = []
    for i, name in enumerate(feature_names):
        impact = final_vector[i] * coefs[i]
        impacts.append((name, impact))

    # Sort by absolute impact
    impacts = sorted(impacts, key=lambda x: abs(x[1]), reverse=True)

    # Humanize
    why = []
    for name, val in impacts[:4]: # Top 4 contributors
        label = FEATURE_LABELS.get(name, name)
        status = "✅" if val > 0 else "⚠️"
        direction = "helped score" if val > 0 else "reduced score"
        why.append(f"{status} {label} {direction}")

    # 5. Get Next Actions
    actions = []
    for rule in ACTION_RULES:
        if rule["check"](deal):
            actions.append(rule["label"])

    return {
        "score": score,
        "why": why,
        "next_actions": actions[:3] # Top 3 actions
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
