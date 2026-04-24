"""
Decisions router — Phase 3 Self-Healing approval workflow.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.middleware.auth import AuthUser
from app.middleware.rbac import require_permission
from app.services import firestore_service
from app.services.decision_engine import (
    generate_decision_cascade, approve_decision,
    reject_decision, get_pending_decisions, get_decision_history
)
from app.services.risk_engine import evaluate_risk

router = APIRouter()


class ApproveRequest(BaseModel):
    action: str  # reroute | mode_switch | consolidate | safe_halt


class RejectRequest(BaseModel):
    reason: str


@router.post("/generate/{shipment_id}")
async def trigger_decision(
    shipment_id: str,
    user: AuthUser = Depends(require_permission("shipment:update")),
):
    """
    Generate a self-healing decision cascade for a high-risk shipment.
    Automatically executes low-impact decisions; queues high-impact for approval.
    """
    shipment = await firestore_service.get_document("shipments", shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.get("org_id") != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get current risk evaluation
    try:
        risk_eval = await evaluate_risk(shipment)
    except Exception:
        risk_eval = {"risk_score": shipment.get("risk_score", 0.8), "risk_level": shipment.get("risk_level", "high")}

    decision = await generate_decision_cascade(shipment, risk_eval)
    return decision


@router.post("/{decision_id}/approve")
async def approve(
    decision_id: str,
    payload: ApproveRequest,
    user: AuthUser = Depends(require_permission("shipment:update")),
):
    """Approve a pending decision and execute the chosen action."""
    result = await approve_decision(decision_id, user.uid, payload.action)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/{decision_id}/reject")
async def reject(
    decision_id: str,
    payload: RejectRequest,
    user: AuthUser = Depends(require_permission("shipment:update")),
):
    """Reject a pending decision."""
    return await reject_decision(decision_id, user.uid, payload.reason)


@router.get("/pending")
async def pending_decisions(
    user: AuthUser = Depends(require_permission("shipment:list")),
):
    """List all decisions awaiting approval for this org."""
    decisions = await get_pending_decisions(user.org_id)
    return {"decisions": decisions, "count": len(decisions)}


@router.get("/history")
async def decision_history(
    limit: int = 100,
    user: AuthUser = Depends(require_permission("shipment:list")),
):
    """Full audit log of all decisions for this org."""
    history = await get_decision_history(user.org_id, limit=limit)
    return {"decisions": history, "count": len(history)}


@router.get("/impact-summary")
async def impact_summary(
    user: AuthUser = Depends(require_permission("shipment:list")),
):
    """
    Aggregate impact of all executed decisions:
    delays prevented, cost saved, emissions reduced.
    """
    history = await get_decision_history(user.org_id, limit=500)
    executed = [d for d in history if d.get("status") in ("approved", "auto_approved")]

    delays_prevented = 0
    cost_saved_inr = 0
    emissions_saved_kg = 0
    risk_reductions = []

    for d in executed:
        action = d.get("recommended_action", {})
        rr = action.get("risk_reduction", 0)
        risk_reductions.append(rr)
        if rr > 0.2:
            delays_prevented += 1
            cost_saved_inr += max(0, -action.get("cost_change_pct", 0)) * 500
        emissions_saved_kg += max(0, -action.get("emissions_change_pct", 0)) * 12

    avg_risk_reduction = sum(risk_reductions) / max(len(risk_reductions), 1)

    return {
        "total_decisions": len(history),
        "executed": len(executed),
        "pending": len([d for d in history if d.get("status") == "pending_approval"]),
        "rejected": len([d for d in history if d.get("status") == "rejected"]),
        "delays_prevented": delays_prevented,
        "cost_saved_inr": round(cost_saved_inr),
        "emissions_saved_kg": round(emissions_saved_kg),
        "avg_risk_reduction_pct": round(avg_risk_reduction * 100, 1),
    }
