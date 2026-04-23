"""
Pydantic models for Shipments.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class RouteWaypoint(BaseModel):
    """A single waypoint in a multi-leg route."""
    name: str
    lat: float
    lng: float
    order: int
    stop_duration_min: Optional[int] = 0  # minutes to stop


class RouteLeg(BaseModel):
    """A single leg of a multi-leg journey."""
    origin: RouteWaypoint
    destination: RouteWaypoint
    transport_mode: str = "truck"  # truck, rail, ship, air
    vehicle_id: Optional[str] = None
    carrier: Optional[str] = None
    distance_km: Optional[float] = None
    estimated_duration_min: Optional[int] = None


class ShipmentCreate(BaseModel):
    # Origin & Destination
    origin_name: str
    origin_lat: float
    origin_lng: float
    destination_name: str
    destination_lat: float
    destination_lng: float

    # Cargo details
    cargo_type: str = "general"  # general, perishable, hazardous, fragile, bulk
    cargo_description: Optional[str] = None
    cargo_weight_kg: float = Field(..., gt=0)
    cargo_value: Optional[float] = None

    # SLA & constraints
    pickup_time: Optional[datetime] = None
    delivery_deadline: Optional[datetime] = None
    priority: str = "normal"  # low, normal, high, critical
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None

    # Route & transport
    transport_mode: str = "truck"  # primary transport mode
    route_legs: Optional[List[RouteLeg]] = None
    waypoints: Optional[List[RouteWaypoint]] = None

    # Notes
    notes: Optional[str] = None


class ShipmentUpdate(BaseModel):
    status: Optional[str] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    eta: Optional[datetime] = None
    risk_score: Optional[float] = None
    notes: Optional[str] = None


class ShipmentResponse(BaseModel):
    id: str
    org_id: str
    origin_name: str
    origin_lat: float
    origin_lng: float
    destination_name: str
    destination_lat: float
    destination_lng: float
    cargo_type: str
    cargo_description: Optional[str] = None
    cargo_weight_kg: float
    cargo_value: Optional[float] = None
    transport_mode: str
    status: str  # draft, pending, in_transit, at_risk, delayed, delivered, cancelled
    priority: str
    pickup_time: Optional[datetime] = None
    delivery_deadline: Optional[datetime] = None
    eta: Optional[datetime] = None
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None  # low, medium, high, critical
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    route_legs: Optional[List[dict]] = None
    waypoints: Optional[List[dict]] = None
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class RiskEvaluation(BaseModel):
    shipment_id: str
    risk_score: float = Field(..., ge=0, le=1)
    risk_level: str
    risk_factors: dict
    confidence: float = Field(..., ge=0, le=1)
    alternatives: Optional[List[dict]] = None
    evaluated_at: datetime


class ShipmentListResponse(BaseModel):
    shipments: List[ShipmentResponse]
    total: int
    page: int
    page_size: int
