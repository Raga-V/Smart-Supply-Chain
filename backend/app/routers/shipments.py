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
