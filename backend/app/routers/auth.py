"""
Auth router — handles signup, login, and token management.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as firebase_auth

from app.middleware.auth import AuthUser, get_current_user
from app.models.organization import OrganizationCreate
from app.models.user import UserProfile
from app.services import firestore_service

router = APIRouter()


@router.post("/signup")
async def signup(payload: OrganizationCreate):
    """
    Register a new organization and create the admin user.
    The frontend handles Firebase Auth user creation;
    this endpoint sets up Firestore records and custom claims.
    """
    org_id = str(uuid.uuid4())

    # Create org document
    org_data = {
        "name": payload.name,
        "industry": payload.industry,
        "country": payload.country,
        "admin_email": payload.admin_email,
        "member_count": 1,
        "shipment_count": 0,
        "status": "active",
    }
    await firestore_service.create_document("organizations", org_data, doc_id=org_id)

    # Find or create Firebase user
    try:
        user_record = firebase_auth.get_user_by_email(payload.admin_email)
    except firebase_auth.UserNotFoundError:
        user_record = firebase_auth.create_user(
            email=payload.admin_email,
            display_name=payload.admin_name,
        )

    # Set custom claims for RBAC
    firebase_auth.set_custom_user_claims(user_record.uid, {
        "org_id": org_id,
        "role": "admin",
    })

    # Create user document
    user_data = {
        "uid": user_record.uid,
        "email": payload.admin_email,
        "display_name": payload.admin_name,
        "role": "admin",
        "org_id": org_id,
        "status": "active",
    }
    await firestore_service.create_document("users", user_data, doc_id=user_record.uid)

    return {
        "org_id": org_id,
        "uid": user_record.uid,
        "message": "Organization created successfully",
    }


@router.get("/profile")
async def get_profile(user: AuthUser = Depends(get_current_user)):
    """Get the current user's profile and organization info."""
    user_doc = await firestore_service.get_document("users", user.uid)

    if not user_doc:
        raise HTTPException(status_code=404, detail="User profile not found")

    org_name = None
    if user.org_id:
        org_doc = await firestore_service.get_document("organizations", user.org_id)
        org_name = org_doc.get("name") if org_doc else None

    return UserProfile(
        uid=user.uid,
        email=user.email,
        display_name=user_doc.get("display_name"),
        role=user_doc.get("role", user.role or "analyst"),
        org_id=user.org_id or user_doc.get("org_id", ""),
        org_name=org_name,
    )


@router.post("/refresh-claims")
async def refresh_claims(user: AuthUser = Depends(get_current_user)):
    """Force-refresh custom claims from Firestore (for role changes)."""
    user_doc = await firestore_service.get_document("users", user.uid)
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    firebase_auth.set_custom_user_claims(user.uid, {
        "org_id": user_doc.get("org_id"),
        "role": user_doc.get("role"),
    })

    return {"message": "Claims refreshed. Re-login to pick up new token."}
