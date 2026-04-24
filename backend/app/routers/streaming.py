"""
Streaming router — start/stop GPS simulation for shipments, list active simulations.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import AuthUser, get_current_user
from app.middleware.rbac import require_permission
from app.services import firestore_service
from app.services.gps_simulator import start_simulation, stop_simulation, get_active_simulations

router = APIRouter()


@router.post("/start/{shipment_id}", status_code=status.HTTP_200_OK)
async def start_gps_simulation(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("shipment:update")),
):
    """Start GPS simulation for a shipment (moves vehicle along route in real-time)."""
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await start_simulation(shipment_id, shipment)
    return result


@router.post("/stop/{shipment_id}", status_code=status.HTTP_200_OK)
async def stop_gps_simulation(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("shipment:update")),
):
    """Stop an active GPS simulation."""
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await stop_simulation(shipment_id)
    return result


@router.get("/active")
async def list_active_simulations(
    user: AuthUser = Depends(require_permission("shipment:list")),
):
    """List all currently active GPS simulations."""
    active_ids = get_active_simulations()
    return {
        "active_simulations": active_ids,
        "count": len(active_ids),
    }
