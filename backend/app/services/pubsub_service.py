"""
Pub/Sub service — publish events to Google Cloud Pub/Sub topics.
"""
import json
from typing import Any, Dict, Optional

from google.cloud import pubsub_v1

from app.config import settings

_publisher: Optional[pubsub_v1.PublisherClient] = None


def get_publisher() -> pubsub_v1.PublisherClient:
    global _publisher
    if _publisher is None:
        _publisher = pubsub_v1.PublisherClient()
    return _publisher


async def publish_event(
    topic_name: str,
    data: Dict[str, Any],
    attributes: Optional[Dict[str, str]] = None,
) -> str:
    """Publish a JSON event to a Pub/Sub topic. Returns the message ID."""
    publisher = get_publisher()
    topic_path = publisher.topic_path(settings.GCP_PROJECT_ID, topic_name)

    message_bytes = json.dumps(data, default=str).encode("utf-8")
    attrs = attributes or {}

    future = publisher.publish(topic_path, message_bytes, **attrs)
    return future.result()


async def publish_shipment_event(
    event_type: str,
    shipment_data: Dict[str, Any],
    org_id: str,
) -> str:
    """Publish a shipment lifecycle event."""
    return await publish_event(
        topic_name=settings.PUBSUB_SHIPMENT_EVENTS,
        data={
            "event_type": event_type,
            "shipment": shipment_data,
            "org_id": org_id,
        },
        attributes={
            "event_type": event_type,
            "org_id": org_id,
        },
    )


async def publish_risk_alert(
    shipment_id: str,
    org_id: str,
    risk_data: Dict[str, Any],
) -> str:
    """Publish a risk alert for a high-risk shipment."""
    return await publish_event(
        topic_name=settings.PUBSUB_RISK_ALERTS,
        data={
            "shipment_id": shipment_id,
            "org_id": org_id,
            "risk": risk_data,
        },
        attributes={
            "org_id": org_id,
            "risk_level": risk_data.get("risk_level", "unknown"),
        },
    )


async def publish_driver_update(
    driver_id: str,
    org_id: str,
    update_data: Dict[str, Any],
) -> str:
    """Publish an update/alert for a driver."""
    return await publish_event(
        topic_name=settings.PUBSUB_DRIVER_UPDATES,
        data={
            "driver_id": driver_id,
            "org_id": org_id,
            "update": update_data,
        },
        attributes={
            "org_id": org_id,
            "driver_id": driver_id,
        },
    )
