"""
Cloud Function: Risk Evaluator
Triggered by Pub/Sub messages on the shipment-events topic.
Evaluates risk and publishes alerts for high-risk shipments.
"""
import json
import base64
import uuid
import random
import functions_framework
from datetime import datetime, timezone
from google.cloud import firestore, pubsub_v1

db = firestore.Client()
publisher = pubsub_v1.PublisherClient()
PROJECT_ID = "solutionchallenge-494200"
RISK_THRESHOLD = 0.7


@functions_framework.cloud_event
def evaluate_risk(cloud_event):
    """Process shipment event and evaluate risk."""
    # Decode message
    data = base64.b64decode(cloud_event.data["message"]["data"])
    event = json.loads(data)

    event_type = event.get("event_type", "")
    shipment = event.get("shipment", {})
    org_id = event.get("org_id", "")
    shipment_id = shipment.get("id", "")

    if not shipment_id:
        print("No shipment_id in event, skipping")
        return

    # Compute risk score (heuristic for now — will call model server in Phase 2)
    risk_score = _compute_risk(shipment)
    risk_level = _classify_risk(risk_score)

    # Update Firestore
    db.collection("shipments").document(shipment_id).update({
        "risk_score": risk_score,
        "risk_level": risk_level,
        "updated_at": datetime.now(timezone.utc),
    })

    print(f"Evaluated shipment {shipment_id}: risk={risk_score:.3f} ({risk_level})")

    # Publish alert if high risk
    if risk_score >= RISK_THRESHOLD:
        alert_data = {
            "shipment_id": shipment_id,
            "org_id": org_id,
            "risk_score": risk_score,
            "risk_level": risk_level,
        }
        topic_path = publisher.topic_path(PROJECT_ID, "risk-alerts")
        publisher.publish(
            topic_path,
            json.dumps(alert_data).encode("utf-8"),
            org_id=org_id,
            risk_level=risk_level,
        )

        # Create alert in Firestore
        db.collection("organizations").document(org_id).collection("alerts").add({
            "type": "risk",
            "title": f"⚠️ Risk Alert: Shipment at {risk_level.upper()} risk",
            "message": f"Shipment {shipment_id[:8]}... has a risk score of {risk_score:.1%}",
            "severity": "critical" if risk_level == "critical" else "danger",
            "shipment_id": shipment_id,
            "action_required": True,
            "read": False,
            "created_at": datetime.now(timezone.utc),
        })
        print(f"Alert created for shipment {shipment_id}")


def _compute_risk(shipment):
    """Heuristic risk computation."""
    score = 0.3
    cargo = shipment.get("cargo_type", "general")
    if cargo in ("perishable", "hazardous"):
        score += 0.15
    if shipment.get("priority") in ("high", "critical"):
        score += 0.10
    score += random.uniform(-0.05, 0.15)
    return max(0, min(1, score))


def _classify_risk(score):
    if score >= 0.8: return "critical"
    if score >= 0.6: return "high"
    if score >= 0.4: return "medium"
    return "low"
