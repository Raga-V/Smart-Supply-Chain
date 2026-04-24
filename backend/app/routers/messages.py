"""
Messages router — internal messaging between roles (Phase 2 enhanced).
Supports unread counts, mark-as-read, thread grouping by shipment, and pagination.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.middleware.auth import AuthUser
from app.middleware.rbac import require_permission
from app.services import firestore_service
from app.services.notification_service import send_message

router = APIRouter()


class SendMessageRequest(BaseModel):
    recipient_id: Optional[str] = None
    recipient_role: Optional[str] = None
    content: str
    message_type: str = "text"  # text | alert | system
    shipment_id: Optional[str] = None


@router.post("/")
async def post_message(
    payload: SendMessageRequest,
    user: AuthUser = Depends(require_permission("message:send")),
):
    """Send a message to a role, user, or shipment thread."""
    msg_id = await send_message(
        org_id=user.org_id,
        sender_id=user.uid,
        sender_name=user.display_name or user.email,
        recipient_id=payload.recipient_id,
        recipient_role=payload.recipient_role,
        content=payload.content,
        message_type=payload.message_type,
        shipment_id=payload.shipment_id,
    )
    return {"id": msg_id, "message": "Message sent"}


@router.get("/")
async def list_messages(
    shipment_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    user: AuthUser = Depends(require_permission("message:read")),
):
    """List messages for the org, optionally filtered by shipment thread."""
    messages = await firestore_service.list_org_documents(
        user.org_id, "messages", limit=limit
    )
    if shipment_id:
        messages = [m for m in messages if m.get("shipment_id") == shipment_id]
    return {"messages": messages}


@router.get("/unread-count")
async def unread_count(
    user: AuthUser = Depends(require_permission("message:read")),
):
    """Get count of unread messages for the current user."""
    messages = await firestore_service.list_org_documents(
        user.org_id, "messages", limit=500
    )
    unread = sum(
        1 for m in messages
        if not m.get("read") and m.get("sender_id") != user.uid
    )
    return {"unread_count": unread}


@router.post("/{message_id}/read")
async def mark_as_read(
    message_id: str,
    user: AuthUser = Depends(require_permission("message:read")),
):
    """Mark a message as read."""
    await firestore_service.update_org_document(
        user.org_id, "messages", message_id, {"read": True}
    )
    return {"message": "Marked as read"}


@router.get("/threads")
async def list_threads(
    user: AuthUser = Depends(require_permission("message:read")),
):
    """
    Group messages into threads by shipment_id.
    Returns [{shipment_id, message_count, last_message, unread_count}]
    """
    messages = await firestore_service.list_org_documents(
        user.org_id, "messages", limit=500
    )
    threads: dict = {}
    for msg in messages:
        key = msg.get("shipment_id") or "__general__"
        if key not in threads:
            threads[key] = {
                "shipment_id": msg.get("shipment_id"),
                "thread_key": key,
                "message_count": 0,
                "unread_count": 0,
                "last_message": None,
                "last_at": None,
            }
        threads[key]["message_count"] += 1
        if not msg.get("read") and msg.get("sender_id") != user.uid:
            threads[key]["unread_count"] += 1
        if threads[key]["last_at"] is None or msg.get("created_at", "") > threads[key]["last_at"]:
            threads[key]["last_message"] = msg.get("content", "")
            threads[key]["last_at"] = msg.get("created_at")

    return {
        "threads": sorted(threads.values(), key=lambda t: t["last_at"] or "", reverse=True)
    }
