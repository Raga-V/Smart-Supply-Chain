"""
Shipment Requests router — Managers submit shipment requests; Admins approve/modify/reject.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.middleware.auth import AuthUser, get_current_user
from app.middleware.rbac import require_role
from app.services import firestore_service
from app.services.notification_service import notify_org

router = APIRouter()


class LegRequest(BaseModel):
    leg_number: int
    origin_name: str
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination_name: str
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    transport_mode: str = "truck"
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    stops: Optional[List[dict]] = None
    estimated_duration_min: Optional[int] = None


class ShipmentRequestCreate(BaseModel):
    title: str
    origin_name: str
    destination_name: str
    cargo_type: str = "general"
    cargo_description: Optional[str] = None
    cargo_weight_kg: Optional[float] = None
    cargo_value: Optional[float] = None
    priority: str = "normal"
    delivery_deadline: Optional[str] = None
    transport_mode: str = "truck"
    legs: Optional[List[LegRequest]] = None
    notes: Optional[str] = None
    reason: Optional[str] = None  # Why this shipment is needed


class ShipmentRequestReview(BaseModel):
    action: str           # approve | reject | modify
    admin_notes: Optional[str] = None
    modifications: Optional[dict] = None


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_shipment_request(
    payload: ShipmentRequestCreate,
    user: AuthUser = Depends(require_role("manager", "admin")),
):
    """Manager submits a shipment creation request for Admin approval."""
    req_id = str(uuid.uuid4())
    req_data = {
        "title": payload.title,
        "origin_name": payload.origin_name,
        "destination_name": payload.destination_name,
        "cargo_type": payload.cargo_type,
        "cargo_description": payload.cargo_description,
        "cargo_weight_kg": payload.cargo_weight_kg,
        "cargo_value": payload.cargo_value,
        "priority": payload.priority,
        "delivery_deadline": payload.delivery_deadline,
        "transport_mode": payload.transport_mode,
        "legs": [leg.model_dump() for leg in payload.legs] if payload.legs else [],
        "notes": payload.notes,
        "reason": payload.reason,
        "status": "pending",
        "requested_by": user.uid,
        "requested_by_name": user.display_name or user.email,
        "org_id": user.org_id,
    }
    await firestore_service.create_document("shipment_requests", req_data, doc_id=req_id)

    # Notify admins
    await notify_org(
        org_id=user.org_id,
        title="New Shipment Request",
        message=f"{user.display_name or user.email} requested: {payload.title} ({payload.origin_name} → {payload.destination_name})",
        type="info",
        target_roles=["admin"],
        ref_id=req_id,
    )

    return {"id": req_id, "message": "Shipment request submitted for Admin approval"}


@router.get("/")
async def list_shipment_requests(
    user: AuthUser = Depends(get_current_user),
):
    """List shipment requests. Admins see all; managers see their own."""
    filters = [("org_id", "==", user.org_id)]
    if user.role == "manager":
        filters.append(("requested_by", "==", user.uid))

    requests = await firestore_service.list_documents(
        "shipment_requests",
        filters=filters,
        order_by="created_at",
        limit=100,
    )
    return {"requests": requests}


@router.get("/pending")
async def pending_requests(user: AuthUser = Depends(require_role("admin"))):
    """Get all pending requests for admin review."""
    requests = await firestore_service.list_documents(
        "shipment_requests",
        filters=[("org_id", "==", user.org_id), ("status", "==", "pending")],
        order_by="created_at",
        limit=50,
    )
    return {"requests": requests, "count": len(requests)}


@router.get("/{req_id}")
async def get_request(req_id: str, user: AuthUser = Depends(get_current_user)):
    req = await firestore_service.get_document("shipment_requests", req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return req


@router.post("/{req_id}/review")
async def review_request(
    req_id: str,
    payload: ShipmentRequestReview,
    user: AuthUser = Depends(require_role("admin")),
):
    """Admin approves, rejects, or requests modification of a shipment request."""
    req = await firestore_service.get_document("shipment_requests", req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")

    action = payload.action.lower()
    if action not in ("approve", "reject", "modify"):
        raise HTTPException(status_code=400, detail="action must be approve|reject|modify")

    update_data = {
        "status": "approved" if action == "approve" else ("rejected" if action == "reject" else "needs_modification"),
        "reviewed_by": user.uid,
        "admin_notes": payload.admin_notes,
        "modifications": payload.modifications,
    }
    await firestore_service.update_document("shipment_requests", req_id, update_data)

    # Notify the requesting manager
    await notify_org(
        org_id=user.org_id,
        title=f"Shipment Request {action.capitalize()}d",
        message=f"Admin {user.display_name or user.email} {action}d your request: {req.get('title')}. {payload.admin_notes or ''}",
        type="success" if action == "approve" else ("warning" if action == "modify" else "alert"),
        target_roles=["manager"],
        ref_id=req_id,
    )

    return {"message": f"Request {action}d", "status": update_data["status"]}
