"""
Notification service — send alerts/notifications via Firestore (real-time).
Messages written to organizations/{org_id}/messages subcollection.
Notifications written to organizations/{org_id}/notifications subcollection.
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.services import firestore_service


async def notify_org(
    org_id: str,
    title: str,
    message: str,
    type: str = "info",            # info | risk | alert | success | warning
    target_roles: Optional[List[str]] = None,
    shipment_id: Optional[str] = None,
    ref_id: Optional[str] = None,
) -> str:
    """Write a notification to organizations/{org_id}/notifications."""
    data = {
        "title": title,
        "message": message,
        "type": type,
        "target_roles": target_roles or ["admin", "manager", "fleet_manager", "analyst", "driver"],
        "shipment_id": shipment_id,
        "ref_id": ref_id,
        "read": False,
    }
    return await firestore_service.create_org_document(
        org_id=org_id,
        sub_collection="notifications",
        data=data,
    )


async def create_alert(
    org_id: str,
    alert_type: str,
    title: str,
    message: str,
    severity: str = "info",
    shipment_id: Optional[str] = None,
    action_required: bool = False,
    target_roles: Optional[list] = None,
) -> str:
    """Create a risk/system alert. Also writes to legacy alerts subcollection."""
    alert_data = {
        "org_id": org_id,
        "type": alert_type,
        "title": title,
        "message": message,
        "severity": severity,
        "shipment_id": shipment_id,
        "action_required": action_required,
        "target_roles": target_roles or ["admin", "manager"],
        "read": False,
        "dismissed": False,
    }
    alert_id = await firestore_service.create_org_document(
        org_id=org_id, sub_collection="alerts", data=alert_data,
    )
    # Also write to notifications so Layout bell picks it up
    await notify_org(
        org_id=org_id,
        title=title,
        message=message,
        type=alert_type,
        target_roles=target_roles or ["admin", "manager"],
        shipment_id=shipment_id,
        ref_id=alert_id,
    )
    return alert_id


async def create_risk_alert(
    org_id: str,
    shipment_id: str,
    risk_score: float,
    risk_level: str,
    risk_factors: Dict,
    alternatives: Optional[list] = None,
    assigned_team: Optional[List[str]] = None,
) -> str:
    """Create a risk alert; notifies entire assigned team."""
    severity_map = {"low": "info", "medium": "warning", "high": "danger", "critical": "critical"}

    title = f"Risk Alert: Shipment at {risk_level.upper()} risk"
    message = (
        f"Shipment {shipment_id[:8]}... risk score {risk_score:.1%}. "
        f"Top factors: {', '.join(f'{k}: {v:.0%}' for k,v in sorted(risk_factors.items(), key=lambda x:-x[1])[:3])}"
    )
    if alternatives:
        message += f". {len(alternatives)} alternative(s) available."

    # Notify all roles — assigned team members will see it
    target_roles = ["admin", "manager", "fleet_manager", "analyst", "driver"]

    return await create_alert(
        org_id=org_id,
        alert_type="risk",
        title=title,
        message=message,
        severity=severity_map.get(risk_level, "info"),
        shipment_id=shipment_id,
        action_required=risk_level in ("high", "critical"),
        target_roles=target_roles,
    )


async def send_message(
    org_id: str,
    sender_id: str,
    sender_name: str,
    recipient_id: Optional[str],
    recipient_role: Optional[str],
    content: str,
    message_type: str = "text",
    shipment_id: Optional[str] = None,
) -> str:
    """Send an internal message. Stored in organizations/{org_id}/messages."""
    message_data = {
        "sender_id": sender_id,
        "sender_name": sender_name,
        "recipient_id": recipient_id,
        "recipient_role": recipient_role,
        "content": content,
        "message_type": message_type,
        "shipment_id": shipment_id,
        "read": False,
    }
    return await firestore_service.create_org_document(
        org_id=org_id,
        sub_collection="messages",
        data=message_data,
    )
