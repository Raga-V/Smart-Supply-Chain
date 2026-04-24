"""
Digital Twin router — Phase 4 pre-dispatch simulation.
Runs Monte Carlo scenarios to predict delay probability before
the shipment is dispatched.
"""
import random
import math
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.middleware.auth import AuthUser
from app.middleware.rbac import require_permission

router = APIRouter()


class SimulationRequest(BaseModel):
    origin_name: str
    destination_name: str
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    transport_mode: str = "truck"
    cargo_type: str = "general"
    cargo_weight_kg: float = 5000
    delivery_deadline_days: int = 3
    n_scenarios: int = 200   # Monte Carlo runs


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _run_scenario(dist_km: float, mode: str, cargo_type: str, weight_kg: float) -> dict:
    """Run a single stochastic scenario. Returns outcome dict."""
    BASE_SPEEDS = {"truck": 60, "rail": 90, "ship": 25, "air": 750}
    speed = BASE_SPEEDS.get(mode, 60)

    # Stochastic factors
    traffic_factor = random.gauss(1.0, 0.12)         # traffic variability
    weather_disruption = random.random() < 0.15       # 15% weather event
    breakdown = random.random() < 0.04                # 4% breakdown
    customs_delay = random.random() < 0.08 if mode in ("ship", "air") else False
    overweight_penalty = 1.2 if weight_kg > 20000 else 1.0

    actual_speed = speed / (traffic_factor * overweight_penalty)
    base_hours = dist_km / actual_speed

    delay_hours = 0
    disruptions = []
    if weather_disruption:
        wh = random.uniform(2, 18)
        delay_hours += wh
        disruptions.append({"type": "weather", "hours": round(wh, 1)})
    if breakdown:
        bh = random.uniform(3, 12)
        delay_hours += bh
        disruptions.append({"type": "breakdown", "hours": round(bh, 1)})
    if customs_delay:
        ch = random.uniform(6, 36)
        delay_hours += ch
        disruptions.append({"type": "customs", "hours": round(ch, 1)})

    # Cargo-type risk multiplier
    CARGO_RISK = {"perishable": 1.4, "hazardous": 1.6, "fragile": 1.2, "general": 1.0, "bulk": 0.9}
    risk_mult = CARGO_RISK.get(cargo_type, 1.0)

    total_hours = (base_hours + delay_hours) * risk_mult
    risk_score = min(0.98, (delay_hours / max(base_hours, 1)) * 0.6 + 0.15 * risk_mult)

    return {
        "total_hours": total_hours,
        "delay_hours": delay_hours,
        "risk_score": risk_score,
        "disruptions": disruptions,
    }


@router.post("/simulate")
async def run_simulation(
    payload: SimulationRequest,
    user: AuthUser = Depends(require_permission("shipment:list")),
):
    """
    Pre-dispatch Digital Twin simulation.
    Runs N Monte Carlo scenarios and returns statistical outcomes.
    """
    n = min(payload.n_scenarios, 500)   # cap at 500
    dist_km = _haversine(
        payload.origin_lat, payload.origin_lng,
        payload.destination_lat, payload.destination_lng
    )

    results = [_run_scenario(dist_km, payload.transport_mode, payload.cargo_type, payload.cargo_weight_kg)
               for _ in range(n)]

    total_hours = sorted([r["total_hours"] for r in results])
    delay_hours = [r["delay_hours"] for r in results]
    risk_scores  = [r["risk_score"] for r in results]

    deadline_hours = payload.delivery_deadline_days * 24
    on_time_count = sum(1 for h in total_hours if h <= deadline_hours)
    delayed_count = n - on_time_count

    # Weather, breakdown, customs hit rates
    weather_hits = sum(1 for r in results if any(d["type"] == "weather" for d in r["disruptions"]))
    breakdown_hits = sum(1 for r in results if any(d["type"] == "breakdown" for d in r["disruptions"]))
    customs_hits = sum(1 for r in results if any(d["type"] == "customs" for d in r["disruptions"]))

    # Percentile calculations
    p10 = total_hours[int(n * 0.10)]
    p50 = total_hours[int(n * 0.50)]
    p90 = total_hours[int(n * 0.90)]
    p99 = total_hours[int(n * 0.99)]
    avg_risk = sum(risk_scores) / n

    # Recommended mode comparison
    mode_comparison = []
    for mode in ["truck", "rail", "ship", "air"]:
        if mode == payload.transport_mode:
            continue
        mode_results = [_run_scenario(dist_km, mode, payload.cargo_type, payload.cargo_weight_kg) for _ in range(50)]
        mode_on_time = sum(1 for r in mode_results if r["total_hours"] <= deadline_hours)
        mode_comparison.append({
            "mode": mode,
            "on_time_pct": round(mode_on_time / 50 * 100, 1),
            "avg_hours": round(sum(r["total_hours"] for r in mode_results) / 50, 1),
            "avg_risk": round(sum(r["risk_score"] for r in mode_results) / 50, 3),
        })

    # Risk timeline — hourly projected risk during journey
    journey_hours = int(p50) + 6
    risk_timeline = []
    for h in range(0, journey_hours, max(1, journey_hours // 24)):
        progress = h / max(journey_hours, 1)
        r = avg_risk * (1 - progress * 0.3) + random.uniform(-0.04, 0.04)
        risk_timeline.append({"hour": h, "risk": round(max(0.05, min(0.95, r)), 3)})

    return {
        "simulation": {
            "n_scenarios": n,
            "distance_km": round(dist_km, 1),
            "route": f"{payload.origin_name} → {payload.destination_name}",
            "mode": payload.transport_mode,
            "cargo_type": payload.cargo_type,
        },
        "on_time_probability": round(on_time_count / n, 3),
        "delay_probability": round(delayed_count / n, 3),
        "delivery_hours": {
            "p10": round(p10, 1),
            "p50": round(p50, 1),
            "p90": round(p90, 1),
            "p99": round(p99, 1),
            "deadline": deadline_hours,
        },
        "avg_risk_score": round(avg_risk, 3),
        "disruption_probabilities": {
            "weather": round(weather_hits / n, 3),
            "breakdown": round(breakdown_hits / n, 3),
            "customs": round(customs_hits / n, 3),
        },
        "mode_comparison": sorted(mode_comparison, key=lambda x: -x["on_time_pct"]),
        "risk_timeline": risk_timeline,
        "recommendation": (
            "PROCEED" if on_time_count / n > 0.75 else
            "CAUTION" if on_time_count / n > 0.50 else
            "CONSIDER_ALTERNATIVE"
        ),
        "recommendation_detail": (
            f"High confidence ({on_time_count/n*100:.0f}% on-time). Proceed with dispatch."
            if on_time_count / n > 0.75 else
            f"Moderate risk ({delayed_count/n*100:.0f}% chance of delay). Review alternatives."
            if on_time_count / n > 0.50 else
            f"High delay risk ({delayed_count/n*100:.0f}%). Consider alternative mode or route."
        ),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
