"""
GPS Simulator Service — simulates realistic vehicle movement along supply chain routes.

Stores GPS track in Firestore for real-time frontend updates via onSnapshot.
Triggers risk recomputation when significant deviations are detected.
"""
import asyncio
import math
import random
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from app.services import firestore_service
from app.config import settings

# Registry of actively simulated shipments
_active_simulations: Dict[str, asyncio.Task] = {}

# Indian city coordinates for realistic routes
INDIAN_CITIES = {
    "Mumbai":      (19.0760, 72.8777),
    "Delhi":       (28.6139, 77.2090),
    "Bangalore":   (12.9716, 77.5946),
    "Chennai":     (13.0827, 80.2707),
    "Kolkata":     (22.5726, 88.3639),
    "Hyderabad":   (17.3850, 78.4867),
    "Pune":        (18.5204, 73.8567),
    "Ahmedabad":   (23.0225, 72.5714),
    "Jaipur":      (26.9124, 75.7873),
    "Lucknow":     (26.8467, 80.9462),
    "Surat":       (21.1702, 72.8311),
    "Nagpur":      (21.1458, 79.0882),
    "Coimbatore":  (11.0168, 76.9558),
    "Kochi":       (9.9312, 76.2673),
    "Bhopal":      (23.2599, 77.4126),
    "Indore":      (22.7196, 75.8577),
    "Patna":       (25.5941, 85.1376),
    "Chandigarh":  (30.7333, 76.7794),
    "Guwahati":    (26.1445, 91.7362),
    "Visakhapatnam": (17.6868, 83.2185),
}


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between two coordinates in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _interpolate(lat1: float, lon1: float, lat2: float, lon2: float, fraction: float) -> Tuple[float, float]:
    """Linearly interpolate between two lat/lng points."""
    return (
        lat1 + (lat2 - lat1) * fraction,
        lon1 + (lon2 - lon1) * fraction,
    )


def _add_noise(lat: float, lng: float, sigma: float = 0.002) -> Tuple[float, float]:
    """Add small GPS noise to simulate real sensor data."""
    return (
        lat + random.gauss(0, sigma),
        lng + random.gauss(0, sigma),
    )


def _speed_kmh_for_mode(transport_mode: str) -> float:
    """Typical average speed by transport mode (km/h)."""
    speeds = {
        "truck": random.uniform(50, 75),
        "rail":  random.uniform(80, 110),
        "ship":  random.uniform(20, 35),
        "air":   random.uniform(700, 900),
    }
    return speeds.get(transport_mode, 60)


def _compute_route_waypoints(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    n_intermediate: int = 3,
) -> List[Tuple[float, float]]:
    """
    Compute a simple multi-segment route between origin and destination.
    Adds slight curve deviation to simulate real roads.
    """
    waypoints = [(origin_lat, origin_lng)]
    for i in range(1, n_intermediate + 1):
        frac = i / (n_intermediate + 1)
        lat, lng = _interpolate(origin_lat, origin_lng, dest_lat, dest_lng, frac)
        # Add road-like deviation
        deviation = random.uniform(-0.3, 0.3)
        waypoints.append((lat + deviation * 0.5, lng + deviation))
    waypoints.append((dest_lat, dest_lng))
    return waypoints


async def start_simulation(shipment_id: str, shipment_data: Dict) -> Dict:
    """
    Start GPS simulation for a shipment.
    Returns immediately; simulation runs in background.
    """
    if shipment_id in _active_simulations:
        existing = _active_simulations[shipment_id]
        if not existing.done():
            return {"status": "already_running", "shipment_id": shipment_id}

    # Mark shipment as being simulated in Firestore
    await firestore_service.update_document("shipments", shipment_id, {
        "gps_simulation_active": True,
        "simulation_started_at": datetime.now(timezone.utc).isoformat(),
        "status": "in_transit",
    })

    task = asyncio.create_task(
        _run_simulation_loop(shipment_id, shipment_data),
        name=f"gps_sim_{shipment_id}",
    )
    _active_simulations[shipment_id] = task

    return {
        "status": "started",
        "shipment_id": shipment_id,
        "task_id": task.get_name(),
    }


async def stop_simulation(shipment_id: str) -> Dict:
    """Stop an active GPS simulation."""
    task = _active_simulations.get(shipment_id)
    if task and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    _active_simulations.pop(shipment_id, None)

    await firestore_service.update_document("shipments", shipment_id, {
        "gps_simulation_active": False,
    })

    return {"status": "stopped", "shipment_id": shipment_id}


def get_active_simulations() -> List[str]:
    """Return list of actively simulated shipment IDs."""
    return [sid for sid, task in _active_simulations.items() if not task.done()]


async def _run_simulation_loop(shipment_id: str, shipment_data: Dict):
    """
    Core simulation loop — moves vehicle along route, updating Firestore every tick.
    """
    transport_mode = shipment_data.get("transport_mode", "truck")
    origin_lat = float(shipment_data.get("origin_lat", 19.0760))
    origin_lng = float(shipment_data.get("origin_lng", 72.8777))
    dest_lat = float(shipment_data.get("destination_lat", 28.6139))
    dest_lng = float(shipment_data.get("destination_lng", 77.2090))
    org_id = shipment_data.get("org_id", "")

    waypoints = _compute_route_waypoints(origin_lat, origin_lng, dest_lat, dest_lng, n_intermediate=4)
    speed_kmh = _speed_kmh_for_mode(transport_mode)

    # Total route distance
    total_distance = sum(
        _haversine(waypoints[i][0], waypoints[i][1], waypoints[i + 1][0], waypoints[i + 1][1])
        for i in range(len(waypoints) - 1)
    )

    # Simulation tick interval — update every 15 seconds (real-time demo)
    # Air mode moves very fast: compress time
    tick_seconds = 15 if transport_mode != "air" else 5
    # Distance covered per tick
    km_per_tick = (speed_kmh / 3600) * tick_seconds * 60  # 60x time compression

    current_waypoint_idx = 0
    progress_on_segment = 0.0  # 0.0 → 1.0
    total_km_covered = 0.0
    disruption_active = False
    disruption_ticks_remaining = 0

    try:
        while current_waypoint_idx < len(waypoints) - 1 and total_km_covered < total_distance:
            seg_start = waypoints[current_waypoint_idx]
            seg_end = waypoints[current_waypoint_idx + 1]
            seg_distance = _haversine(seg_start[0], seg_start[1], seg_end[0], seg_end[1])

            # Random disruption events
            if not disruption_active and random.random() < 0.08:
                disruption_active = True
                disruption_ticks_remaining = random.randint(3, 8)
                disruption_type = random.choice(["weather", "traffic", "breakdown", "customs"])

                # Publish disruption event to Firestore
                event_id = str(uuid.uuid4())
                await firestore_service.create_document(
                    f"shipments/{shipment_id}/events",
                    {
                        "type": "disruption",
                        "subtype": disruption_type,
                        "message": _disruption_message(disruption_type),
                        "severity": "high" if disruption_type in ("breakdown", "customs") else "medium",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                    doc_id=event_id,
                )

            # Apply disruption — vehicle slows/stops
            if disruption_active:
                disruption_ticks_remaining -= 1
                effective_km = km_per_tick * 0.2  # 80% slowdown
                if disruption_ticks_remaining <= 0:
                    disruption_active = False
            else:
                # Add speed variation
                speed_variation = random.uniform(0.7, 1.15)
                effective_km = km_per_tick * speed_variation

            progress_on_segment += effective_km / max(seg_distance, 0.1)
            total_km_covered += effective_km

            # Advance to next segment if needed
            while progress_on_segment >= 1.0 and current_waypoint_idx < len(waypoints) - 2:
                progress_on_segment -= 1.0
                current_waypoint_idx += 1
                seg_start = waypoints[current_waypoint_idx]
                seg_end = waypoints[current_waypoint_idx + 1]
                seg_distance = _haversine(seg_start[0], seg_start[1], seg_end[0], seg_end[1])

            # Compute current position
            frac = min(progress_on_segment, 1.0)
            curr_lat, curr_lng = _interpolate(seg_start[0], seg_start[1], seg_end[0], seg_end[1], frac)
            curr_lat, curr_lng = _add_noise(curr_lat, curr_lng)

            progress_pct = min(99.9, (total_km_covered / max(total_distance, 1)) * 100)
            remaining_km = max(0, total_distance - total_km_covered)
            eta_hours = remaining_km / max(speed_kmh, 1)

            # Risk recomputation based on disruption
            risk_bump = 0.15 if disruption_active else 0.0
            base_risk = shipment_data.get("risk_score", 0.3) or 0.3
            current_risk = min(1.0, base_risk + risk_bump + random.uniform(-0.03, 0.05))
            risk_level = _classify_risk(current_risk)

            # Update Firestore — triggers onSnapshot in frontend
            update = {
                "current_lat": round(curr_lat, 6),
                "current_lng": round(curr_lng, 6),
                "current_speed_kmh": round(speed_kmh * (0.2 if disruption_active else 1.0), 1),
                "progress_pct": round(progress_pct, 1),
                "remaining_distance_km": round(remaining_km, 1),
                "eta_hours": round(eta_hours, 2),
                "last_gps_update": datetime.now(timezone.utc).isoformat(),
                "disruption_active": disruption_active,
                "risk_score": round(current_risk, 4),
                "risk_level": risk_level,
                "gps_simulation_active": True,
            }
            await firestore_service.update_document("shipments", shipment_id, update)

            # Also write to GPS track subcollection
            track_point = {
                "lat": round(curr_lat, 6),
                "lng": round(curr_lng, 6),
                "speed_kmh": update["current_speed_kmh"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "progress_pct": round(progress_pct, 1),
                "disruption": disruption_active,
            }
            await firestore_service.create_document(
                f"shipments/{shipment_id}/gps_track",
                track_point,
                doc_id=str(uuid.uuid4()),
            )

            await asyncio.sleep(tick_seconds)

        # Journey complete
        await firestore_service.update_document("shipments", shipment_id, {
            "current_lat": round(dest_lat, 6),
            "current_lng": round(dest_lng, 6),
            "progress_pct": 100.0,
            "status": "delivered",
            "gps_simulation_active": False,
            "delivered_at": datetime.now(timezone.utc).isoformat(),
        })
        _active_simulations.pop(shipment_id, None)

    except asyncio.CancelledError:
        await firestore_service.update_document("shipments", shipment_id, {
            "gps_simulation_active": False,
        })
        raise


def _classify_risk(score: float) -> str:
    if score >= 0.8: return "critical"
    if score >= 0.6: return "high"
    if score >= 0.4: return "medium"
    return "low"


def _disruption_message(disruption_type: str) -> str:
    messages = {
        "weather": "Severe weather conditions detected. Vehicle slowing down.",
        "traffic": "Heavy traffic congestion on route. Significant delays expected.",
        "breakdown": "Vehicle breakdown reported. Awaiting roadside assistance.",
        "customs": "Shipment held at customs checkpoint. Documentation review in progress.",
    }
    return messages.get(disruption_type, "Disruption detected on route.")
