"""
Decision Engine Service — Phase 3 Self-Healing.

Priority cascade:
  1. Reroute       — alternative highway/road
  2. Mode switch   — change transport mode
  3. Consolidate   — merge with nearby shipment
  4. Safe halt     — divert to nearest warehouse/hub

Every decision is audited in Firestore for full traceability.
"""
import uuid
import random
import math
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.services import firestore_service
from app.config import settings


# ── Indian city coordinates & warehouses ─────────────────────
WAREHOUSES = [
    {"name": "Mumbai Hub",        "lat": 19.0760, "lng": 72.8777, "capacity_pct": 0.62},
    {"name": "Delhi DC",          "lat": 28.6139, "lng": 77.2090, "capacity_pct": 0.45},
    {"name": "Bangalore Centre",  "lat": 12.9716, "lng": 77.5946, "capacity_pct": 0.71},
    {"name": "Chennai Port Hub",  "lat": 13.0827, "lng": 80.2707, "capacity_pct": 0.38},
    {"name": "Kolkata Gateway",   "lat": 22.5726, "lng": 88.3639, "capacity_pct": 0.55},
    {"name": "Hyderabad Depot",   "lat": 17.3850, "lng": 78.4867, "capacity_pct": 0.80},
    {"name": "Nagpur Transit",    "lat": 21.1458, "lng": 79.0882, "capacity_pct": 0.30},
    {"name": "Ahmedabad ICD",     "lat": 23.0225, "lng": 72.5714, "capacity_pct": 0.60},
]

MODE_SPEEDS = {"truck": 65, "rail": 95, "ship": 28, "air": 800}
MODE_COSTS  = {"truck": 1.0, "rail": 0.65, "ship": 0.45, "air": 4.2}   # relative per km
MODE_EMISSION = {"truck": 1.0, "rail": 0.30, "ship": 0.20, "air": 3.5}  # relative


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_warehouse(lat: float, lng: float) -> Dict:
    return min(WAREHOUSES, key=lambda w: _haversine(lat, lng, w["lat"], w["lng"]))


async def generate_decision_cascade(shipment: Dict, risk_eval: Dict) -> Dict:
    """
    Generate the full 4-tier decision cascade for a high-risk shipment.
    Returns the best recommendation and all alternatives.
    """
    shipment_id = shipment.get("id", "")
    org_id = shipment.get("org_id", "")
    risk_score = risk_eval.get("risk_score", 0.8)
    current_mode = shipment.get("transport_mode", "truck")

    o_lat = float(shipment.get("origin_lat", 19.076))
    o_lng = float(shipment.get("origin_lng", 72.877))
    d_lat = float(shipment.get("destination_lat", 28.613))
    d_lng = float(shipment.get("destination_lng", 77.209))
    dist_km = _haversine(o_lat, o_lng, d_lat, d_lng)

    options = []

    # ── Tier 1: Reroute ──────────────────────────────────────
    alt_dist = dist_km * random.uniform(1.05, 1.22)
    reroute_risk = max(0.08, risk_score - random.uniform(0.25, 0.45))
    reroute_eta  = (alt_dist / MODE_SPEEDS[current_mode]) * 60   # minutes
    options.append({
        "type": "reroute",
        "tier": 1,
        "title": "Alternative Route",
        "description": f"Switch to secondary route via inland highway (+{((alt_dist/dist_km)-1)*100:.0f}% distance). Avoids disruption zone.",
        "risk_reduction": round(risk_score - reroute_risk, 3),
        "new_risk_score": round(reroute_risk, 3),
        "eta_change_min": round((alt_dist - dist_km) / MODE_SPEEDS[current_mode] * 60),
        "cost_change_pct": round((alt_dist / dist_km - 1) * 100, 1),
        "emissions_change_pct": round((alt_dist / dist_km - 1) * 100, 1),
        "confidence": round(random.uniform(0.78, 0.94), 2),
        "requires_approval": False,
    })

    # ── Tier 2: Mode Switch ───────────────────────────────────
    alt_modes = [m for m in ["truck", "rail", "air"] if m != current_mode]
    best_mode = min(alt_modes, key=lambda m: abs(MODE_COSTS[m] - MODE_COSTS[current_mode]) + 0.3)
    mode_risk = max(0.1, risk_score - random.uniform(0.15, 0.35))
    cost_delta = (MODE_COSTS[best_mode] - MODE_COSTS[current_mode]) / MODE_COSTS[current_mode] * 100
    eta_delta  = (dist_km / MODE_SPEEDS[best_mode] - dist_km / MODE_SPEEDS[current_mode]) * 60
    options.append({
        "type": "mode_switch",
        "tier": 2,
        "title": f"Switch to {best_mode.capitalize()}",
        "description": f"Change transport from {current_mode} to {best_mode}. Better route availability in current conditions.",
        "new_mode": best_mode,
        "risk_reduction": round(risk_score - mode_risk, 3),
        "new_risk_score": round(mode_risk, 3),
        "eta_change_min": round(eta_delta),
        "cost_change_pct": round(cost_delta, 1),
        "emissions_change_pct": round((MODE_EMISSION[best_mode] - MODE_EMISSION[current_mode]) / MODE_EMISSION[current_mode] * 100, 1),
        "confidence": round(random.uniform(0.70, 0.88), 2),
        "requires_approval": abs(cost_delta) > 15,
    })

    # ── Tier 3: Consolidate ───────────────────────────────────
    consol_risk = max(0.12, risk_score - random.uniform(0.10, 0.28))
    options.append({
        "type": "consolidate",
        "tier": 3,
        "title": "Load Consolidation",
        "description": "Transfer cargo to a nearby vehicle on a safer route. Reduces per-unit risk through shared load.",
        "risk_reduction": round(risk_score - consol_risk, 3),
        "new_risk_score": round(consol_risk, 3),
        "eta_change_min": random.randint(60, 240),
        "cost_change_pct": round(random.uniform(-8, 5), 1),
        "emissions_change_pct": round(random.uniform(-15, -5), 1),
        "available_vehicles": random.randint(1, 4),
        "confidence": round(random.uniform(0.60, 0.78), 2),
        "requires_approval": True,
    })

    # ── Tier 4: Safe Halt ─────────────────────────────────────
    curr_lat = float(shipment.get("current_lat", o_lat))
    curr_lng = float(shipment.get("current_lng", o_lng))
    hub = _nearest_warehouse(curr_lat, curr_lng)
    hub_dist = _haversine(curr_lat, curr_lng, hub["lat"], hub["lng"])
    halt_eta = (hub_dist / MODE_SPEEDS[current_mode]) * 60
    options.append({
        "type": "safe_halt",
        "tier": 4,
        "title": f"Safe Halt → {hub['name']}",
        "description": f"Divert to {hub['name']} ({hub_dist:.0f} km away, {hub['capacity_pct']*100:.0f}% capacity available). Hold until conditions improve.",
        "halt_location": hub["name"],
        "halt_lat": hub["lat"],
        "halt_lng": hub["lng"],
        "hub_distance_km": round(hub_dist, 1),
        "risk_reduction": round(risk_score - 0.12, 3),
        "new_risk_score": 0.12,
        "eta_change_min": round(halt_eta + 120),  # travel + wait estimate
        "cost_change_pct": round(random.uniform(10, 25), 1),
        "emissions_change_pct": round(random.uniform(-5, 5), 1),
        "confidence": 0.98,
        "requires_approval": True,
    })

    # Best option = highest risk reduction with confidence > 0.7
    best = max(
        [o for o in options if o["confidence"] >= 0.7],
        key=lambda x: x["risk_reduction"],
    )

    decision = {
        "decision_id": str(uuid.uuid4()),
        "shipment_id": shipment_id,
        "org_id": org_id,
        "trigger_risk_score": round(risk_score, 4),
        "trigger_risk_level": risk_eval.get("risk_level", "high"),
        "recommended_action": best,
        "all_options": options,
        "status": "pending_approval" if best.get("requires_approval") else "auto_approved",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "auto_executed": not best.get("requires_approval"),
        "executed_by": None,
    }

    # Persist to Firestore
    await firestore_service.create_document(
        "decisions", decision, doc_id=decision["decision_id"]
    )

    return decision


async def approve_decision(decision_id: str, approved_by: str, approved_action: str) -> Dict:
    """Mark a decision as approved and execute it."""
    decision = await firestore_service.get_document("decisions", decision_id)
    if not decision:
        return {"error": "Decision not found"}

    update = {
        "status": "approved",
        "executed_by": approved_by,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "executed_action": approved_action,
    }
    await firestore_service.update_document("decisions", decision_id, update)

    # Update shipment with new action
    shipment_id = decision.get("shipment_id")
    if shipment_id and approved_action == "reroute":
        await firestore_service.update_document("shipments", shipment_id, {
            "decision_applied": "reroute",
            "risk_score": decision["recommended_action"]["new_risk_score"],
            "risk_level": _classify_risk(decision["recommended_action"]["new_risk_score"]),
        })
    elif shipment_id and approved_action == "mode_switch":
        option = next((o for o in decision["all_options"] if o["type"] == "mode_switch"), None)
        if option:
            await firestore_service.update_document("shipments", shipment_id, {
                "transport_mode": option.get("new_mode"),
                "decision_applied": "mode_switch",
                "risk_score": option["new_risk_score"],
                "risk_level": _classify_risk(option["new_risk_score"]),
            })

    return {**decision, **update}


async def reject_decision(decision_id: str, rejected_by: str, reason: str) -> Dict:
    """Mark a decision as rejected."""
    update = {
        "status": "rejected",
        "executed_by": rejected_by,
        "rejected_at": datetime.now(timezone.utc).isoformat(),
        "rejection_reason": reason,
    }
    await firestore_service.update_document("decisions", decision_id, update)
    return {"decision_id": decision_id, "status": "rejected"}


async def get_pending_decisions(org_id: str) -> List[Dict]:
    """Get all pending decisions requiring approval for an org."""
    return await firestore_service.list_documents(
        "decisions",
        filters=[("org_id", "==", org_id), ("status", "==", "pending_approval")],
        limit=50,
    )


async def get_decision_history(org_id: str, limit: int = 100) -> List[Dict]:
    """Get full decision audit log for an org."""
    return await firestore_service.list_documents(
        "decisions",
        filters=[("org_id", "==", org_id)],
        order_by="created_at",
        limit=limit,
    )


def _classify_risk(score: float) -> str:
    if score >= 0.8: return "critical"
    if score >= 0.6: return "high"
    if score >= 0.4: return "medium"
    return "low"
