"""
Pydantic models for Organizations.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class WarehouseBase(BaseModel):
    name: str
    address: str
    lat: float
    lng: float
    capacity: Optional[float] = None
    zone: Optional[str] = None


class FleetVehicleBase(BaseModel):
    vehicle_id: str
    vehicle_type: str  # truck, van, rail, ship, air
    capacity_kg: float
    status: str = "available"  # available, in_transit, maintenance


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    industry: Optional[str] = None
    country: str = "India"
    admin_email: str
    admin_name: str


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    industry: Optional[str] = None
    country: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    member_count: int = 0
    shipment_count: int = 0


class InviteUserRequest(BaseModel):
    email: str
    role: str = Field(..., pattern="^(admin|manager|analyst|fleet_manager|driver)$")
    display_name: Optional[str] = None


class DeliveryZone(BaseModel):
    name: str
    description: Optional[str] = None
    polygon: Optional[List[dict]] = None  # list of {lat, lng} points
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None


class TransitHub(BaseModel):
    name: str
    hub_type: str  # warehouse, port, rail_yard, airport
    address: str
    lat: float
    lng: float
    capacity: Optional[float] = None


class CarrierPartnership(BaseModel):
    carrier_name: str
    carrier_type: str  # trucking, rail, shipping, air_cargo
    reliability_score: float = Field(default=0.8, ge=0, le=1)
    contract_active: bool = True
