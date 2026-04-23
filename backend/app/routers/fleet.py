"""
Fleet router — vehicle management.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import AuthUser
from app.middleware.rbac import require_permission
from app.models.organization import FleetVehicleBase
from app.services import firestore_service

router = APIRouter()


@router.post("/vehicles")
async def add_vehicle(
    payload: FleetVehicleBase,
    user: AuthUser = Depends(require_permission("fleet:create")),
):
    vehicle_id = await firestore_service.create_org_document(
        user.org_id, "vehicles", payload.model_dump()
    )
    return {"id": vehicle_id, "message": "Vehicle added"}


@router.get("/vehicles")
async def list_vehicles(user: AuthUser = Depends(require_permission("fleet:read"))):
    vehicles = await firestore_service.list_org_documents(user.org_id, "vehicles")
    return {"vehicles": vehicles}


@router.put("/vehicles/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    payload: FleetVehicleBase,
    user: AuthUser = Depends(require_permission("fleet:update")),
):
    client = firestore_service.get_client()
    doc_ref = (
        client.collection("organizations")
        .document(user.org_id)
        .collection("vehicles")
        .document(vehicle_id)
    )
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    doc_ref.update(payload.model_dump())
    return {"message": "Vehicle updated"}


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: str,
    user: AuthUser = Depends(require_permission("fleet:delete")),
):
    client = firestore_service.get_client()
    doc_ref = (
        client.collection("organizations")
        .document(user.org_id)
        .collection("vehicles")
        .document(vehicle_id)
    )
    doc_ref.delete()
    return {"message": "Vehicle deleted"}


@router.get("/stats")
async def fleet_stats(user: AuthUser = Depends(require_permission("fleet:read"))):
    vehicles = await firestore_service.list_org_documents(user.org_id, "vehicles", limit=500)
    total = len(vehicles)
    available = sum(1 for v in vehicles if v.get("status") == "available")
    in_transit = sum(1 for v in vehicles if v.get("status") == "in_transit")
    maintenance = sum(1 for v in vehicles if v.get("status") == "maintenance")
    total_capacity = sum(v.get("capacity_kg", 0) for v in vehicles)

    return {
        "total": total,
        "available": available,
        "in_transit": in_transit,
        "maintenance": maintenance,
        "total_capacity_kg": total_capacity,
    }
