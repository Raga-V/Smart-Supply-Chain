"""
Role-Based Access Control (RBAC) middleware.
"""
from functools import wraps
from typing import List

from fastapi import HTTPException, status

from app.middleware.auth import AuthUser

# ── Permission Matrix ────────────────────────────────────────

ROLE_HIERARCHY = {
    "admin": 4,
    "manager": 3,
    "analyst": 2,
    "fleet_manager": 2,
    "driver": 1,
}

# Actions mapped to minimum required roles
PERMISSIONS = {
    # Organization management
    "org:create": ["admin"],
    "org:update": ["admin"],
    "org:delete": ["admin"],
    "org:read": ["admin", "manager", "analyst", "fleet_manager", "driver"],

    # User management
    "user:invite": ["admin"],
    "user:assign_role": ["admin"],
    "user:remove": ["admin"],
    "user:list": ["admin", "manager"],

    # Shipment management
    "shipment:create": ["admin"],          # Only admin can create; managers submit requests
    "shipment:update": ["admin", "manager"],
    "shipment:delete": ["admin"],
    "shipment:read": ["admin", "manager", "analyst", "fleet_manager", "driver"],
    "shipment:list": ["admin", "manager", "analyst", "fleet_manager"],

    # Fleet management
    "fleet:create": ["admin", "fleet_manager"],
    "fleet:update": ["admin", "fleet_manager"],
    "fleet:delete": ["admin"],
    "fleet:read": ["admin", "manager", "fleet_manager", "driver"],

    # Warehouse management
    "warehouse:create": ["admin", "manager"],
    "warehouse:update": ["admin", "manager"],
    "warehouse:delete": ["admin"],
    "warehouse:read": ["admin", "manager", "analyst", "fleet_manager"],

    # Risk & decisions
    "risk:evaluate": ["admin", "manager"],
    "risk:read": ["admin", "manager", "analyst"],
    "decision:approve": ["admin", "manager"],
    "decision:override": ["admin"],

    # Messages
    "message:send": ["admin", "manager", "fleet_manager", "driver", "analyst"],
    "message:read": ["admin", "manager", "fleet_manager", "driver", "analyst"],

    # Analytics
    "analytics:read": ["admin", "manager", "analyst"],
    "analytics:export": ["admin", "analyst"],

    # Audit
    "audit:read": ["admin"],
}


def check_permission(user: AuthUser, action: str) -> bool:
    """Check if a user has permission to perform an action."""
    if user.role is None:
        return False

    allowed_roles = PERMISSIONS.get(action, [])
    return user.role in allowed_roles


def require_role(*roles: str):
    """
    Dependency that checks if the current user has one of the specified roles.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user: AuthUser = Depends(require_role("admin"))):
            ...
    """
    from fastapi import Depends
    from app.middleware.auth import get_current_user

    async def role_checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(roles)}. Your role: {user.role}",
            )
        return user

    return role_checker


def require_permission(action: str):
    """
    Dependency that checks if the current user has a specific permission.

    Usage:
        @router.post("/shipments")
        async def create_shipment(user: AuthUser = Depends(require_permission("shipment:create"))):
            ...
    """
    from fastapi import Depends
    from app.middleware.auth import get_current_user

    async def permission_checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if not check_permission(user, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {action}",
            )
        return user

    return permission_checker


def require_org_access():
    """Ensure the user belongs to an organization."""
    from fastapi import Depends
    from app.middleware.auth import get_current_user

    async def org_checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if user.org_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No organization associated with this account",
            )
        return user

    return org_checker
