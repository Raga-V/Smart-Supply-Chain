"""
ML Model Server — serves delay prediction model via FastAPI on Cloud Run.
"""
import os
import pickle
import json
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

app = FastAPI(title="Supply Chain ML Model Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model artifacts directory
MODEL_DIR = os.environ.get(
    "MODEL_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_artifacts")
)

# Global model references
classifier = None
regressor = None
metadata = None

FEATURE_ORDER = [
    "distance_km", "cargo_type_encoded", "cargo_weight_kg",
    "transport_mode_encoded", "priority_encoded",
    "carrier_reliability", "weather_risk", "traffic_congestion",
    "temperature", "hour_of_day", "day_of_week", "month",
]


class PredictRequest(BaseModel):
    features: Dict[str, float]


class BatchPredictRequest(BaseModel):
    instances: List[Dict[str, float]]


@app.on_event("startup")
async def load_models():
    global classifier, regressor, metadata

    clf_path = os.path.join(MODEL_DIR, "delay_classifier.pkl")
    reg_path = os.path.join(MODEL_DIR, "delay_regressor.pkl")
    meta_path = os.path.join(MODEL_DIR, "model_metadata.json")

    try:
        if os.path.exists(clf_path):
            with open(clf_path, "rb") as f:
                classifier = pickle.load(f)
            print(f"Loaded classifier from {clf_path}")

        if os.path.exists(reg_path):
            with open(reg_path, "rb") as f:
                regressor = pickle.load(f)
            print(f"Loaded regressor from {reg_path}")

        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                metadata = json.load(f)
            print(f"Model metadata: {metadata.get('model_version')}")
    except Exception as e:
        print(f"ERROR loading model artifacts: {e}")
        print("Falling back to heuristic predictions.")

    if classifier is None:
        print("WARNING: No model artifacts found. Using fallback heuristic.")


def _features_to_array(features: Dict[str, float]) -> np.ndarray:
    """Convert feature dict to ordered numpy array."""
    return np.array([[features.get(f, 0.0) for f in FEATURE_ORDER]])


@app.get("/")
async def health():
    return {
        "status": "healthy",
        "model_loaded": classifier is not None,
        "version": metadata.get("model_version") if metadata else "none",
    }


@app.post("/predict/delay")
async def predict_delay(request: PredictRequest):
    """Predict delay probability for a single shipment."""
    features = request.features
    X = _features_to_array(features)

    if classifier is not None and regressor is not None:
        delay_class = int(classifier.predict(X)[0])
        delay_prob = float(regressor.predict(X)[0])
        delay_prob = max(0, min(1, delay_prob))
        confidence = float(max(classifier.predict_proba(X)[0]))
    else:
        # Heuristic fallback
        delay_prob = _heuristic_predict(features)
        delay_class = 1 if delay_prob >= 0.5 else 0
        confidence = 0.6

    return {
        "delay_probability": round(delay_prob, 4),
        "is_delayed": delay_class,
        "confidence": round(confidence, 4),
        "model_version": metadata.get("model_version") if metadata else "heuristic",
    }


@app.post("/predict/batch")
async def predict_batch(request: BatchPredictRequest):
    """Batch prediction for multiple shipments."""
    results = []
    for instance in request.instances:
        X = _features_to_array(instance)
        if classifier is not None and regressor is not None:
            delay_prob = float(regressor.predict(X)[0])
            delay_prob = max(0, min(1, delay_prob))
            results.append({
                "delay_probability": round(delay_prob, 4),
                "is_delayed": int(classifier.predict(X)[0]),
            })
        else:
            prob = _heuristic_predict(instance)
            results.append({
                "delay_probability": round(prob, 4),
                "is_delayed": 1 if prob >= 0.5 else 0,
            })
    return {"predictions": results}


@app.get("/model/info")
async def model_info():
    """Return model metadata and metrics."""
    if metadata:
        return metadata
    return {"error": "No model loaded"}


def _heuristic_predict(features: Dict[str, float]) -> float:
    """Fallback heuristic when no model is loaded."""
    score = 0.2
    score += features.get("weather_risk", 0) * 0.25
    score += features.get("traffic_congestion", 0) * 0.15
    score += (1 - features.get("carrier_reliability", 0.8)) * 0.2
    if features.get("distance_km", 0) > 1000:
        score += 0.1
    return max(0, min(1, score))
