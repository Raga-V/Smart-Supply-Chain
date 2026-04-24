"""
Organizations router — CRUD for organizations, user management, and configuration.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as firebase_auth

from app.middleware.auth import AuthUser, get_current_user
from app.middleware.rbac import require_permission
from app.models.organization import (
    OrganizationUpdate,
    InviteUserRequest,
    WarehouseBase,
    DeliveryZone,
    TransitHub,
    CarrierPartnership,
)
from app.services import firestore_service

router = APIRouter()


# ── Organization CRUD ────────────────────────────────────────

@router.get("/")
async def get_organization(user: AuthUser = Depends(require_permission("org:read"))):
    """Get the current user's organization."""
    org = await firestore_service.get_document("organizations", user.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.put("/")
async def update_organization(
    payload: OrganizationUpdate,
    user: AuthUser = Depends(require_permission("org:update")),
):
    """Update organization details."""
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await firestore_service.update_document("organizations", user.org_id, update_data)
    return {"message": "Organization updated"}


# ── User Management ──────────────────────────────────────────

@router.post("/invite")
async def invite_user(
    payload: InviteUserRequest,
    user: AuthUser = Depends(require_permission("user:invite")),
):
    """Invite a user to the organization and assign a role."""
    # Create Firebase user if not exists
    try:
        target_user = firebase_auth.get_user_by_email(payload.email)
    except firebase_auth.UserNotFoundError:
        target_user = firebase_auth.create_user(
            email=payload.email,
            display_name=payload.display_name or payload.email.split("@")[0],
        )

    # Set custom claims
    firebase_auth.set_custom_user_claims(target_user.uid, {
        "org_id": user.org_id,
        "role": payload.role,
    })

    # Generate password reset link so invited user can set their own password
    invite_link = None
    try:
        invite_link = firebase_auth.generate_password_reset_link(payload.email)
    except Exception:
        pass  # Non-critical — admin can still share the link manually

    # Store user document
    user_data = {
        "uid": target_user.uid,
        "email": payload.email,
        "display_name": payload.display_name or payload.email.split("@")[0],
        "role": payload.role,
        "org_id": user.org_id,
        "status": "invited",
        "invited_by": user.uid,
        "invite_link": invite_link,
    }
    await firestore_service.create_document("users", user_data, doc_id=target_user.uid)

    # Increment member count
    org = await firestore_service.get_document("organizations", user.org_id)
    org_name = org.get("name", "your organization") if org else "your organization"
    if org:
        await firestore_service.update_document(
            "organizations", user.org_id,
            {"member_count": org.get("member_count", 0) + 1}
        )

    # Notify org about new team member
    from app.services.notification_service import notify_org
    await notify_org(
        org_id=user.org_id,
        title="New Team Member Invited",
        message=f"{payload.display_name or payload.email} has been invited as {payload.role.replace('_', ' ').title()}.",
        type="info",
        target_roles=["admin"],
    )

    return {
        "uid": target_user.uid,
        "message": f"User invited as {payload.role}",
        "invite_link": invite_link,
        "note": "Share the invite_link with the user so they can set their password and log in.",
    }


@router.get("/users")
async def list_users(user: AuthUser = Depends(require_permission("user:list"))):
    """List all users in the organization."""
    users = await firestore_service.list_documents(
        "users",
        filters=[("org_id", "==", user.org_id)],
        order_by="created_at",
    )
    return {"users": users}


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str,
    user: AuthUser = Depends(require_permission("user:assign_role")),
):
    """Change a user's role."""
    valid_roles = ["admin", "manager", "analyst", "fleet_manager", "driver"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    # Update Firestore
    await firestore_service.update_document("users", user_id, {"role": role})

    # Update Firebase custom claims
    firebase_auth.set_custom_user_claims(user_id, {
        "org_id": user.org_id,
        "role": role,
    })

    return {"message": f"User role updated to {role}"}


# ── Delivery Zones ───────────────────────────────────────────

@router.post("/delivery-zones")
async def create_delivery_zone(
    payload: DeliveryZone,
    user: AuthUser = Depends(require_permission("warehouse:create")),
):
    zone_id = await firestore_service.create_org_document(
        user.org_id, "delivery_zones", payload.model_dump()
    )
    return {"id": zone_id, "message": "Delivery zone created"}


@router.get("/delivery-zones")
async def list_delivery_zones(user: AuthUser = Depends(require_permission("warehouse:read"))):
    zones = await firestore_service.list_org_documents(user.org_id, "delivery_zones")
    return {"delivery_zones": zones}


# ── Transit Hubs ─────────────────────────────────────────────

@router.post("/transit-hubs")
async def create_transit_hub(
    payload: TransitHub,
    user: AuthUser = Depends(require_permission("warehouse:create")),
):
    hub_id = await firestore_service.create_org_document(
        user.org_id, "transit_hubs", payload.model_dump()
    )
    return {"id": hub_id, "message": "Transit hub created"}


@router.get("/transit-hubs")
async def list_transit_hubs(user: AuthUser = Depends(require_permission("warehouse:read"))):
    hubs = await firestore_service.list_org_documents(user.org_id, "transit_hubs")
    return {"transit_hubs": hubs}


# ── Carrier Partnerships ────────────────────────────────────

@router.post("/carriers")
async def create_carrier(
    payload: CarrierPartnership,
    user: AuthUser = Depends(require_permission("org:update")),
):
    carrier_id = await firestore_service.create_org_document(
        user.org_id, "carriers", payload.model_dump()
    )
    return {"id": carrier_id, "message": "Carrier partnership created"}


@router.get("/carriers")
async def list_carriers(user: AuthUser = Depends(require_permission("org:read"))):
    carriers = await firestore_service.list_org_documents(user.org_id, "carriers")
    return {"carriers": carriers}
