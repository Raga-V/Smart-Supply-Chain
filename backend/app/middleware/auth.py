"""
Firebase Authentication middleware — verifies ID tokens and injects user context.
"""
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

security = HTTPBearer(auto_error=False)


class AuthUser:
    """Authenticated user context extracted from Firebase token."""

    def __init__(
        self,
        uid: str,
        email: str,
        org_id: Optional[str] = None,
        role: Optional[str] = None,
        display_name: Optional[str] = None,
    ):
        self.uid = uid
        self.email = email
        self.org_id = org_id
        self.role = role
        self.display_name = display_name


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthUser:
    """
    Extract and verify the Firebase ID token from the Authorization header.
    Injects org_id and role from custom claims.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    token = credentials.credentials

    try:
        decoded = firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )

    return AuthUser(
        uid=decoded["uid"],
        email=decoded.get("email", ""),
        org_id=decoded.get("org_id"),
        role=decoded.get("role"),
        display_name=decoded.get("name"),
    )


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[AuthUser]:
    """Same as get_current_user but returns None instead of 401."""
    if credentials is None:
        return None
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None
