"""
Pydantic models for Users.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    email: str
    display_name: str
    role: str = Field(..., pattern="^(admin|manager|analyst|fleet_manager|driver)$")
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(admin|manager|analyst|fleet_manager|driver)$")
    phone: Optional[str] = None
    status: Optional[str] = None


class UserResponse(BaseModel):
    uid: str
    email: str
    display_name: Optional[str] = None
    role: str
    org_id: str
    phone: Optional[str] = None
    status: str = "active"
    last_login: Optional[datetime] = None
    created_at: datetime


class UserProfile(BaseModel):
    uid: str
    email: str
    display_name: Optional[str] = None
    role: str
    org_id: str
    org_name: Optional[str] = None
    permissions: Optional[list] = None
