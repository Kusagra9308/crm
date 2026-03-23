"""
FastAPI ML Prediction Server
Run with: py -3.11 predict_api.py
Exposes POST /predict -> returns { ai_score: float }
"""

import os
import numpy as np
import joblib
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
        print(f"✅ Model loaded from {MODEL_PATH}")
    else:
        print(f"⚠️  No model found at {MODEL_PATH}. Run ml_pipeline.py first.")
    yield  # app runs here

app = FastAPI(title="Deal AI Scoring API", version="1.0.0", lifespan=lifespan)

# Allow requests from Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Request schema ─────────────────────────────────────────────────────────────
class DealFeatures(BaseModel):
    amount: float
    num_touchpoints: int = 5
    email_response_rate: float = 0.5
    discount_requested: float = 0.1
    demo_completed: bool = False
    champion_identified: bool = False
    days_in_stage: int = 10

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

    features = np.array([[
        deal.amount,
        deal.email_response_rate,
        deal.discount_requested,
        int(deal.demo_completed),
        int(deal.champion_identified),
    ]], dtype=float)

    score = float(round(model.predict_proba(features)[0][1] * 100, 2))
    return {"ai_score": score}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
