"""
Notification service — send alerts via Firestore (real-time) and FCM (push).
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from app.services import firestore_service


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
    """
    Create an alert in Firestore for real-time dashboard updates.
    """
    alert_data = {
        "org_id": org_id,
        "type": alert_type,
        "title": title,
        "message": message,
        "severity": severity,  # info, warning, danger, critical
        "shipment_id": shipment_id,
        "action_required": action_required,
        "target_roles": target_roles or ["admin", "manager"],
        "read": False,
        "dismissed": False,
    }

    alert_id = await firestore_service.create_org_document(
        org_id=org_id,
        sub_collection="alerts",
        data=alert_data,
    )

    return alert_id


async def create_risk_alert(
    org_id: str,
    shipment_id: str,
    risk_score: float,
    risk_level: str,
    risk_factors: Dict,
    alternatives: Optional[list] = None,
) -> str:
    """Create a risk-specific alert with action items."""
    severity_map = {
        "low": "info",
        "medium": "warning",
        "high": "danger",
        "critical": "critical",
    }

    title = f"{'⚠️' if risk_level in ('high', 'critical') else 'ℹ️'} Risk Alert: Shipment at {risk_level.upper()} risk"
    message = (
        f"Shipment {shipment_id[:8]}... has a risk score of {risk_score:.1%}. "
        f"Top factors: {', '.join(f'{k}: {v:.0%}' for k, v in sorted(risk_factors.items(), key=lambda x: -x[1])[:3])}"
    )

    if alternatives:
        message += f". {len(alternatives)} alternative(s) available."

    return await create_alert(
        org_id=org_id,
        alert_type="risk",
        title=title,
        message=message,
        severity=severity_map.get(risk_level, "info"),
        shipment_id=shipment_id,
        action_required=risk_level in ("high", "critical"),
        target_roles=["admin", "manager"],
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
    """Send an internal message between users."""
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
