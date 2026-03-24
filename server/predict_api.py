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
from fastapi import FastAPI, HTTPException
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

# Map frontend stage names to model numeric labels
STAGE_MAP = {
    "Appointment Scheduled": 1,
    "Qualified to Buy": 2,
    "Presentation Scheduled": 3,
    "Decision Maker Bought-In": 4,
    "Contract Sent": 5
}

# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}

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

    # Convert stage name to numeric value
    stage_num = STAGE_MAP.get(deal.stage, 1)

    # Order must match ml_pipeline features: 
    # [amount, stage_numeric, note_count, deal_age, demo_completed, champion_identified, days_to_close]
    features = np.array([[
        deal.amount,
        float(stage_num),
        float(deal.note_count),
        float(deal.deal_age),
        float(deal.demo_completed),
        float(deal.champion_identified),
        float(deal.days_to_close)
    ]], dtype=float)

    score = float(round(model.predict_proba(features)[0][1] * 100, 2))
    
    # --- V8 Aggressive Safety Net ---
    # If it's a 'Perfect Setup' deal, ensure it has a high floor for the demo
    if deal.stage == "Contract Sent" and deal.demo_completed and deal.champion_identified:
        score = max(score, 88.0)
        
    return {"ai_score": score}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
