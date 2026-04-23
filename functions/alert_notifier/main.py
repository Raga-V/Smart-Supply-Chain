"""
Cloud Function: Alert Notifier
Triggered by Pub/Sub messages on the risk-alerts topic.
Sends push notifications and updates dashboard alerts.
"""
import json
import base64
import functions_framework
from datetime import datetime, timezone
from google.cloud import firestore

db = firestore.Client()


@functions_framework.cloud_event
def notify_alert(cloud_event):
    """Process risk alert and notify relevant users."""
    data = base64.b64decode(cloud_event.data["message"]["data"])
    alert = json.loads(data)

    org_id = alert.get("org_id", "")
    shipment_id = alert.get("shipment_id", "")
    risk_level = alert.get("risk_level", "unknown")

    print(f"Processing alert for shipment {shipment_id} (org: {org_id}, risk: {risk_level})")

    # In Phase 2, this would send FCM push notifications
    # For now, we ensure the Firestore alert is created (done in risk_evaluator)

    # Log the notification
    db.collection("organizations").document(org_id).collection("notification_log").add({
        "type": "risk_alert",
        "shipment_id": shipment_id,
        "risk_level": risk_level,
        "channel": "dashboard",  # dashboard, push, email
        "status": "delivered",
        "created_at": datetime.now(timezone.utc),
    })

    print(f"Notification logged for org {org_id}")
