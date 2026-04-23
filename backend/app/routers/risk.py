"""
Risk router — trigger risk evaluation and get risk data.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import AuthUser
from app.middleware.rbac import require_permission
from app.services import firestore_service
from app.services.risk_engine import evaluate_risk
from app.services.notification_service import create_risk_alert
from app.config import settings

router = APIRouter()


@router.post("/evaluate/{shipment_id}")
async def evaluate_shipment_risk(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("risk:evaluate")),
):
    """Run risk evaluation on a specific shipment."""
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    risk_eval = await evaluate_risk(shipment)

    # Update shipment risk fields
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

    return risk_eval


@router.get("/shipment/{shipment_id}")
async def get_shipment_risk(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("risk:read")),
):
    """Get the latest risk evaluation for a shipment."""
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "shipment_id": shipment_id,
        "risk_score": shipment.get("risk_score"),
        "risk_level": shipment.get("risk_level"),
    }


@router.get("/alerts")
async def get_risk_alerts(user: AuthUser = Depends(require_permission("risk:read"))):
    """Get all risk alerts for the organization."""
    alerts = await firestore_service.list_org_documents(user.org_id, "alerts", limit=50)
    return {"alerts": alerts}
