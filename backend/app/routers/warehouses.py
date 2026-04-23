"""
Warehouses router — CRUD for warehouses and storage locations.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import AuthUser
from app.middleware.rbac import require_permission
from app.models.organization import WarehouseBase
from app.services import firestore_service

router = APIRouter()


@router.post("/")
async def create_warehouse(
    payload: WarehouseBase,
    user: AuthUser = Depends(require_permission("warehouse:create")),
):
    wh_id = await firestore_service.create_org_document(
        user.org_id, "warehouses", payload.model_dump()
    )
    return {"id": wh_id, "message": "Warehouse created"}


@router.get("/")
async def list_warehouses(user: AuthUser = Depends(require_permission("warehouse:read"))):
    warehouses = await firestore_service.list_org_documents(user.org_id, "warehouses")
    return {"warehouses": warehouses}


@router.put("/{warehouse_id}")
async def update_warehouse(
    warehouse_id: str,
    payload: WarehouseBase,
    user: AuthUser = Depends(require_permission("warehouse:update")),
):
    client = firestore_service.get_client()
    doc_ref = (
        client.collection("organizations").document(user.org_id)
        .collection("warehouses").document(warehouse_id)
    )
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    doc_ref.update(payload.model_dump())
    return {"message": "Warehouse updated"}


@router.delete("/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: str,
    user: AuthUser = Depends(require_permission("warehouse:delete")),
):
    client = firestore_service.get_client()
    client.collection("organizations").document(user.org_id).collection("warehouses").document(warehouse_id).delete()
    return {"message": "Warehouse deleted"}
