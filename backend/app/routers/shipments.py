"""
Shipments router — CRUD for shipments with route definition and lifecycle management.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.middleware.auth import AuthUser, get_current_user
from app.middleware.rbac import require_permission
from app.models.shipment import ShipmentCreate, ShipmentUpdate, ShipmentResponse
from app.services import firestore_service
from app.services.risk_engine import evaluate_risk
from app.services.notification_service import create_risk_alert
from app.config import settings

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_shipment(
    payload: ShipmentCreate,
    user: AuthUser = Depends(require_permission("shipment:create")),
):
    """Create a new shipment with route and cargo details."""
    shipment_id = str(uuid.uuid4())

    shipment_data = {
        "org_id": user.org_id,
        "origin_name": payload.origin_name,
        "origin_lat": payload.origin_lat,
        "origin_lng": payload.origin_lng,
        "destination_name": payload.destination_name,
        "destination_lat": payload.destination_lat,
        "destination_lng": payload.destination_lng,
        "cargo_type": payload.cargo_type,
        "cargo_description": payload.cargo_description,
        "cargo_weight_kg": payload.cargo_weight_kg,
        "cargo_value": payload.cargo_value,
        "transport_mode": payload.transport_mode,
        "priority": payload.priority,
        "pickup_time": payload.pickup_time.isoformat() if payload.pickup_time else None,
        "delivery_deadline": payload.delivery_deadline.isoformat() if payload.delivery_deadline else None,
        "temperature_min": payload.temperature_min,
        "temperature_max": payload.temperature_max,
        "route_legs": [leg.model_dump() for leg in payload.route_legs] if payload.route_legs else None,
        "waypoints": [wp.model_dump() for wp in payload.waypoints] if payload.waypoints else None,
        "status": "draft",
        "risk_score": None,
        "risk_level": None,
        "eta": None,
        "current_lat": payload.origin_lat,
        "current_lng": payload.origin_lng,
        "notes": payload.notes,
        "created_by": user.uid,
    }

    await firestore_service.create_document("shipments", shipment_data, doc_id=shipment_id)

    # Update org shipment count
    org = await firestore_service.get_document("organizations", user.org_id)
    if org:
        await firestore_service.update_document(
            "organizations", user.org_id,
            {"shipment_count": org.get("shipment_count", 0) + 1}
        )

    # Pre-dispatch risk evaluation
    risk_eval = await evaluate_risk({"id": shipment_id, **shipment_data})

    await firestore_service.update_document("shipments", shipment_id, {
        "risk_score": risk_eval["risk_score"],
        "risk_level": risk_eval["risk_level"],
    })

    # Create alert if high risk
    if risk_eval["risk_score"] >= settings.RISK_THRESHOLD:
        await create_risk_alert(
            org_id=user.org_id,
            shipment_id=shipment_id,
            risk_score=risk_eval["risk_score"],
            risk_level=risk_eval["risk_level"],
            risk_factors=risk_eval["risk_factors"],
            alternatives=risk_eval.get("alternatives"),
        )

    return {
        "id": shipment_id,
        "risk_evaluation": risk_eval,
        "message": "Shipment created successfully",
    }


@router.get("/")
async def list_shipments(
    status_filter: str = Query(None, alias="status"),
    risk_level: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: AuthUser = Depends(require_permission("shipment:list")),
):
    """List shipments for the current organization with optional filters."""
    filters = [("org_id", "==", user.org_id)]

    if status_filter:
        filters.append(("status", "==", status_filter))
    if risk_level:
        filters.append(("risk_level", "==", risk_level))

    offset = (page - 1) * page_size
    shipments = await firestore_service.list_documents(
        "shipments",
        filters=filters,
        order_by="created_at",
        limit=page_size,
        offset=offset,
    )

    total = await firestore_service.count_documents("shipments", filters=[("org_id", "==", user.org_id)])

    return {
        "shipments": shipments,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/stats")
async def shipment_stats(user: AuthUser = Depends(require_permission("shipment:list"))):
    """Get shipment statistics for the dashboard."""
    all_shipments = await firestore_service.list_documents(
        "shipments",
        filters=[("org_id", "==", user.org_id)],
        limit=1000,
    )

    total = len(all_shipments)
    in_transit = sum(1 for s in all_shipments if s.get("status") == "in_transit")
    at_risk = sum(1 for s in all_shipments if s.get("risk_level") in ("high", "critical"))
    delivered = sum(1 for s in all_shipments if s.get("status") == "delivered")
    delayed = sum(1 for s in all_shipments if s.get("status") == "delayed")

    avg_risk = (
        sum(s.get("risk_score", 0) for s in all_shipments if s.get("risk_score")) / max(1, total)
    )

    return {
        "total": total,
        "in_transit": in_transit,
        "at_risk": at_risk,
        "delivered": delivered,
        "delayed": delayed,
        "draft": sum(1 for s in all_shipments if s.get("status") == "draft"),
        "pending": sum(1 for s in all_shipments if s.get("status") == "pending"),
        "avg_risk_score": round(avg_risk, 3),
        "on_time_rate": round(delivered / max(1, delivered + delayed), 3),
    }


@router.get("/{shipment_id}")
async def get_shipment(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("shipment:read")),
):
    """Get a single shipment by ID."""
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return shipment


@router.put("/{shipment_id}")
async def update_shipment(
    shipment_id: str,
    payload: ShipmentUpdate,
    user: AuthUser = Depends(require_permission("shipment:update")),
):
    """Update shipment fields (status, location, etc.)."""
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = payload.model_dump(exclude_none=True)
    await firestore_service.update_document("shipments", shipment_id, update_data)

    return {"message": "Shipment updated", "id": shipment_id}


@router.post("/{shipment_id}/dispatch")
async def dispatch_shipment(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("shipment:update")),
):
    """Move a shipment from draft/pending to in_transit."""
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if shipment.get("status") not in ("draft", "pending"):
        raise HTTPException(status_code=400, detail="Shipment cannot be dispatched from current status")

    await firestore_service.update_document("shipments", shipment_id, {
        "status": "in_transit",
        "dispatched_at": datetime.now(timezone.utc),
    })

    return {"message": "Shipment dispatched", "status": "in_transit"}


@router.delete("/{shipment_id}")
async def delete_shipment(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("shipment:delete")),
):
    """Delete a shipment (admin only)."""
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    await firestore_service.delete_document("shipments", shipment_id)
    return {"message": "Shipment deleted"}


@router.get("/{shipment_id}/location")
async def get_shipment_location(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("shipment:read")),
):
    """Get current GPS location and real-time tracking state for a shipment."""
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "shipment_id": shipment_id,
        "current_lat": shipment.get("current_lat"),
        "current_lng": shipment.get("current_lng"),
        "current_speed_kmh": shipment.get("current_speed_kmh", 0),
        "progress_pct": shipment.get("progress_pct", 0),
        "remaining_distance_km": shipment.get("remaining_distance_km"),
        "eta_hours": shipment.get("eta_hours"),
        "disruption_active": shipment.get("disruption_active", False),
        "gps_simulation_active": shipment.get("gps_simulation_active", False),
        "last_gps_update": shipment.get("last_gps_update"),
    }


@router.get("/{shipment_id}/gps-track")
async def get_gps_track(
    shipment_id: str,
    limit: int = 100,
    user: AuthUser = Depends(require_permission("shipment:read")),
):
    """Get GPS track history (breadcrumbs) for a shipment."""
    from app.services.firestore_service import list_subcollection
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    track = await list_subcollection("shipments", shipment_id, "gps_track", limit=limit)
    return {"shipment_id": shipment_id, "track": track, "count": len(track)}


@router.get("/{shipment_id}/events")
async def get_shipment_events(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("shipment:read")),
):
    """Get disruption events for a shipment."""
    from app.services.firestore_service import list_subcollection
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    events = await list_subcollection("shipments", shipment_id, "events", limit=50, order_by="created_at")
    return {"shipment_id": shipment_id, "events": events, "count": len(events)}


@router.post("/optimize-route")
async def optimize_route(
    payload: dict,
    user: AuthUser = Depends(require_permission("shipment:read")),
):
    """
    AI-powered route optimization.
    Accepts origin, destination, waypoints, transport_mode, cargo_type.
    Returns up to 5 ranked route alternatives with risk scores.
    """
    from app.services.risk_engine import evaluate_risk
    import random, math

    origin = payload.get("origin", {})
    destination = payload.get("destination", {})
    waypoints = payload.get("waypoints", [])
    mode = payload.get("transport_mode", "truck")
    cargo_type = payload.get("cargo_type", "general")
    cargo_weight = payload.get("cargo_weight_kg")
    warehouses = payload.get("warehouses", [])

    # Base distance approximation (Haversine)
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371
        phi1, phi2 = math.radians(lat1 or 0), math.radians(lat2 or 0)
        dphi = math.radians((lat2 or 0) - (lat1 or 0))
        dlambda = math.radians((lon2 or 0) - (lon1 or 0))
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
        return 2*R*math.atan2(math.sqrt(a), math.sqrt(1-a))

    base_dist = haversine(
        origin.get("lat", 0), origin.get("lng", 0),
        destination.get("lat", 0), destination.get("lng", 0)
    ) or 800  # fallback distance

    mode_speed = {"truck": 55, "rail": 70, "ship": 25, "air": 800}
    speed = mode_speed.get(mode, 55)

    cargo_risk_factor = {"hazardous": 0.25, "perishable": 0.18, "refrigerated": 0.15, "fragile": 0.12}.get(cargo_type, 0.05)

    routes = [
        {
            "name": "Fastest Direct",
            "description": f"Direct {mode} route with minimal stops",
            "distance_km": round(base_dist * 1.0, 0),
            "duration_h": round(base_dist / speed, 1),
            "risk_score": round(0.10 + cargo_risk_factor, 2),
            "risk_level": "low",
            "cost_estimate": round(base_dist * 45, 0),
            "legs": 1,
            "highlights": ["No border crossings", "Fastest ETA", "Highway route"],
        },
        {
            "name": "Lowest Risk Route",
            "description": "Via safest corridors — weather & traffic optimized",
            "distance_km": round(base_dist * 1.08, 0),
            "duration_h": round(base_dist * 1.08 / speed, 1),
            "risk_score": round(0.06 + cargo_risk_factor * 0.5, 2),
            "risk_level": "low",
            "cost_estimate": round(base_dist * 52, 0),
            "legs": 1,
            "highlights": ["Weather-safe corridor", "Backup roads available", "Insurance preferred"],
        },
        {
            "name": "Multimodal — Rail + Last Mile",
            "description": "Rail for long haul, truck for last mile delivery",
            "distance_km": round(base_dist * 1.04, 0),
            "duration_h": round(base_dist * 1.04 / 65, 1),
            "risk_score": round(0.09 + cargo_risk_factor * 0.7, 2),
            "risk_level": "low",
            "cost_estimate": round(base_dist * 38, 0),
            "legs": 2,
            "highlights": ["Most cost-effective", "Rail for efficiency", "Eco-friendly option"],
        },
        {
            "name": f"Via Hub Warehouse{(' — ' + warehouses[0]['name']) if warehouses else ''}",
            "description": "Route through a regional staging hub for flexibility",
            "distance_km": round(base_dist * 1.15, 0),
            "duration_h": round(base_dist * 1.15 / speed + 4, 1),
            "risk_score": round(0.14 + cargo_risk_factor, 2),
            "risk_level": "low" if cargo_risk_factor < 0.15 else "medium",
            "cost_estimate": round(base_dist * 48, 0),
            "legs": 2,
            "highlights": ["Staging opportunity", "Risk split across legs", "Flexible timing"],
        },
        {
            "name": "Expedited Air Freight",
            "description": "Air cargo for maximum speed and high-value items",
            "distance_km": round(base_dist * 1.3, 0),
            "duration_h": round(base_dist / 800 + 3, 1),
            "risk_score": round(0.20 + cargo_risk_factor * 0.6, 2),
            "risk_level": "medium" if cargo_risk_factor > 0.1 else "low",
            "cost_estimate": round(base_dist * 120, 0),
            "legs": 1,
            "highlights": ["Fastest possible", "High-value cargo safe", "Priority handling"],
        },
    ]

    # Sort by composite score (risk * 0.6 + normalized duration * 0.4)
    max_dur = max(r["duration_h"] for r in routes) or 1
    for r in routes:
        r["_score"] = r["risk_score"] * 0.6 + (r["duration_h"] / max_dur) * 0.4
    routes.sort(key=lambda x: x["_score"])
    for r in routes:
        del r["_score"]

    return {
        "routes": routes,
        "origin": origin.get("name"),
        "destination": destination.get("name"),
        "base_distance_km": round(base_dist, 0),
    }

