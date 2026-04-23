"""
Messages router — internal messaging between roles.
"""
from fastapi import APIRouter, Depends, Query
from app.middleware.auth import AuthUser
from app.middleware.rbac import require_permission
from app.services.notification_service import send_message
from app.services import firestore_service
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class SendMessageRequest(BaseModel):
    recipient_id: Optional[str] = None
    recipient_role: Optional[str] = None
    content: str
    message_type: str = "text"
    shipment_id: Optional[str] = None


@router.post("/")
async def post_message(
    payload: SendMessageRequest,
    user: AuthUser = Depends(require_permission("message:send")),
):
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
    messages = await firestore_service.list_org_documents(
        user.org_id, "messages", limit=limit
    )
    if shipment_id:
        messages = [m for m in messages if m.get("shipment_id") == shipment_id]
    return {"messages": messages}
