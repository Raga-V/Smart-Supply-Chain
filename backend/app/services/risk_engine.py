"""
Risk Engine Service — computes composite risk scores using the ML model server.
"""
import uuid
import random
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from app.config import settings


async def evaluate_risk(
    shipment_data: Dict,
    features: Optional[Dict] = None,
) -> Dict:
    """
    Evaluate the risk for a shipment by calling the ML model server.
    Falls back to a heuristic model if the model server is unavailable.
    """
    try:
        # Prepare features for the model
        model_features = _prepare_features(shipment_data, features)

        # Call model server
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.MODEL_SERVER_URL}/predict/delay",
                json={"features": model_features},
            )
            if response.status_code == 200:
                prediction = response.json()
                risk_score = prediction.get("delay_probability", 0.5)
            else:
                # Fallback to heuristic
                risk_score = _heuristic_risk(shipment_data)
    except (httpx.ConnectError, httpx.TimeoutException):
        # Model server unavailable — use heuristic
        risk_score = _heuristic_risk(shipment_data)

    risk_level = _classify_risk(risk_score)
    risk_factors = _compute_risk_factors(shipment_data, features)
    confidence = min(0.95, 0.6 + random.uniform(0, 0.3))  # Simulated confidence

    evaluation = {
        "score_id": str(uuid.uuid4()),
        "shipment_id": shipment_data.get("id", ""),
        "org_id": shipment_data.get("org_id", ""),
        "risk_score": round(risk_score, 4),
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "confidence": round(confidence, 4),
        "model_version": "v1.0-lgbm",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Generate alternatives if high risk
    if risk_score >= settings.RISK_THRESHOLD:
        evaluation["alternatives"] = _generate_alternatives(shipment_data, risk_score)

    return evaluation


def _prepare_features(shipment: Dict, extra: Optional[Dict] = None) -> Dict:
    """Prepare feature vector for the model."""
    import math

    origin_lat = shipment.get("origin_lat", 0)
    origin_lng = shipment.get("origin_lng", 0)
    dest_lat = shipment.get("destination_lat") or shipment.get("dest_lat", 0)
    dest_lng = shipment.get("destination_lng") or shipment.get("dest_lng", 0)

    # Approximate distance using Haversine
    distance = _haversine(origin_lat, origin_lng, dest_lat, dest_lng)

    features = {
        "distance_km": distance,
        "cargo_weight_kg": shipment.get("cargo_weight_kg", 0),
        "transport_mode_encoded": {"truck": 0, "rail": 1, "ship": 2, "air": 3}.get(
            shipment.get("transport_mode", "truck"), 0
        ),
        "cargo_type_encoded": {
            "general": 0, "perishable": 1, "hazardous": 2, "fragile": 3, "bulk": 4
        }.get(shipment.get("cargo_type", "general"), 0),
        "priority_encoded": {"low": 0, "normal": 1, "high": 2, "critical": 3}.get(
            shipment.get("priority", "normal"), 1
        ),
        "hour_of_day": datetime.now().hour,
        "day_of_week": datetime.now().weekday(),
        # Synthetic environmental features
        "weather_risk": random.uniform(0, 0.8),
        "traffic_congestion": random.uniform(0, 1),
        "carrier_reliability": random.uniform(0.6, 1.0),
    }

    if extra:
        features.update(extra)

    return features


def _heuristic_risk(shipment: Dict) -> float:
    """Fallback heuristic risk scoring when model server is unavailable."""
    score = 0.3  # base risk

    # Distance factor
    distance = _haversine(
        shipment.get("origin_lat", 0),
        shipment.get("origin_lng", 0),
        shipment.get("destination_lat", shipment.get("dest_lat", 0)),
        shipment.get("destination_lng", shipment.get("dest_lng", 0)),
    )
    if distance > 1500:
        score += 0.15
    elif distance > 500:
        score += 0.08

    # Cargo sensitivity
    cargo_type = shipment.get("cargo_type", "general")
    if cargo_type in ("perishable", "hazardous"):
        score += 0.15
    elif cargo_type == "fragile":
        score += 0.10

    # Priority urgency
    if shipment.get("priority") == "critical":
        score += 0.10
    elif shipment.get("priority") == "high":
        score += 0.05

    # Random environmental noise
    score += random.uniform(-0.05, 0.15)

    return max(0.0, min(1.0, score))


def _classify_risk(score: float) -> str:
    """Classify risk score into levels."""
    if score >= 0.8:
        return "critical"
    elif score >= 0.6:
        return "high"
    elif score >= 0.4:
        return "medium"
    return "low"


def _compute_risk_factors(shipment: Dict, features: Optional[Dict] = None) -> Dict:
    """Compute breakdown of individual risk factors."""
    return {
        "weather": round(random.uniform(0.1, 0.7), 2),
        "traffic": round(random.uniform(0.1, 0.8), 2),
        "carrier_reliability": round(random.uniform(0.6, 1.0), 2),
        "cargo_sensitivity": 0.8 if shipment.get("cargo_type") in ("perishable", "hazardous") else 0.3,
        "route_complexity": round(random.uniform(0.2, 0.7), 2),
        "time_pressure": 0.7 if shipment.get("priority") in ("high", "critical") else 0.3,
    }


def _generate_alternatives(shipment: Dict, current_risk: float) -> List[Dict]:
    """Generate alternative route/mode suggestions for high-risk shipments."""
    alternatives = []

    # Alternative 1: Different route
    alternatives.append({
        "type": "reroute",
        "description": "Alternative route via secondary highway",
        "risk_score": round(max(0.1, current_risk - random.uniform(0.15, 0.35)), 3),
        "eta_impact_min": random.randint(30, 120),
        "cost_impact_pct": round(random.uniform(5, 20), 1),
        "confidence": round(random.uniform(0.7, 0.9), 2),
    })

    # Alternative 2: Mode switch
    modes = ["truck", "rail", "ship", "air"]
    current_mode = shipment.get("transport_mode", "truck")
    alt_mode = random.choice([m for m in modes if m != current_mode])
    alternatives.append({
        "type": "mode_switch",
        "description": f"Switch from {current_mode} to {alt_mode}",
        "new_mode": alt_mode,
        "risk_score": round(max(0.1, current_risk - random.uniform(0.1, 0.25)), 3),
        "eta_impact_min": random.randint(-60, 180),
        "cost_impact_pct": round(random.uniform(-10, 30), 1),
        "confidence": round(random.uniform(0.6, 0.85), 2),
    })

    return sorted(alternatives, key=lambda a: a["risk_score"])


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers."""
    import math

    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
