"""
Synthetic data generator for supply chain ML models.
Generates realistic shipment data across Indian cities with
weather, traffic, and carrier features.
"""
import csv
import os
import random
import math
from datetime import datetime, timedelta

# Indian city coordinates for realistic routes
INDIAN_CITIES = {
    "Mumbai": (19.076, 72.8777),
    "Delhi": (28.7041, 77.1025),
    "Bangalore": (12.9716, 77.5946),
    "Chennai": (13.0827, 80.2707),
    "Kolkata": (22.5726, 88.3639),
    "Hyderabad": (17.385, 78.4867),
    "Pune": (18.5204, 73.8567),
    "Ahmedabad": (23.0225, 72.5714),
    "Jaipur": (26.9124, 75.7873),
    "Lucknow": (26.8467, 80.9462),
    "Surat": (21.1702, 72.8311),
    "Nagpur": (21.1458, 79.0882),
    "Indore": (22.7196, 75.8577),
    "Coimbatore": (11.0168, 76.9558),
    "Visakhapatnam": (17.6868, 83.2185),
    "Kochi": (9.9312, 76.2673),
    "Guwahati": (26.1445, 91.7362),
    "Chandigarh": (30.7333, 76.7794),
    "Bhopal": (23.2599, 77.4126),
    "Thiruvananthapuram": (8.5241, 76.9366),
}

CARGO_TYPES = ["general", "perishable", "hazardous", "fragile", "bulk"]
TRANSPORT_MODES = ["truck", "rail", "ship", "air"]
PRIORITIES = ["low", "normal", "high", "critical"]
CARRIERS = [
    "BlueDart Express", "Gati Ltd", "TCI Freight",
    "Rivigo", "Delhivery", "XpressBees",
    "Safexpress", "VRL Logistics", "IndiaRail Cargo", "Air India Cargo",
]

WEATHER_CONDITIONS = ["clear", "cloudy", "rain", "heavy_rain", "fog", "storm"]


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def generate_dataset(num_samples=10000, output_path=None):
    """Generate synthetic shipment data with labels."""
    if output_path is None:
        output_path = os.path.join(os.path.dirname(__file__), "synthetic_shipments.csv")

    cities = list(INDIAN_CITIES.keys())
    records = []

    for i in range(num_samples):
        # Pick origin/destination
        origin_city = random.choice(cities)
        dest_city = random.choice([c for c in cities if c != origin_city])
        o_lat, o_lng = INDIAN_CITIES[origin_city]
        d_lat, d_lng = INDIAN_CITIES[dest_city]

        distance = haversine(o_lat, o_lng, d_lat, d_lng)
        cargo_type = random.choice(CARGO_TYPES)
        transport_mode = random.choice(TRANSPORT_MODES)
        priority = random.choice(PRIORITIES)
        carrier = random.choice(CARRIERS)
        weather = random.choice(WEATHER_CONDITIONS)

        # Time features
        hour = random.randint(0, 23)
        day_of_week = random.randint(0, 6)
        month = random.randint(1, 12)

        # Numerical features
        cargo_weight = round(random.uniform(10, 25000), 1)
        carrier_reliability = round(random.uniform(0.5, 1.0), 3)
        traffic_congestion = round(random.uniform(0, 1), 3)
        temperature = round(random.uniform(5, 45), 1)

        # Weather risk based on condition
        weather_risk_map = {
            "clear": random.uniform(0, 0.15),
            "cloudy": random.uniform(0.1, 0.3),
            "rain": random.uniform(0.3, 0.6),
            "heavy_rain": random.uniform(0.5, 0.85),
            "fog": random.uniform(0.4, 0.7),
            "storm": random.uniform(0.7, 1.0),
        }
        weather_risk = round(weather_risk_map[weather], 3)

        # Encode categoricals
        cargo_encoded = CARGO_TYPES.index(cargo_type)
        mode_encoded = TRANSPORT_MODES.index(transport_mode)
        priority_encoded = PRIORITIES.index(priority)

        # Compute delay probability (realistic formula)
        base_delay = 0.15
        delay_prob = base_delay

        # Distance factor
        if distance > 1500:
            delay_prob += 0.12
        elif distance > 800:
            delay_prob += 0.06

        # Weather impact
        delay_prob += weather_risk * 0.25

        # Traffic impact
        delay_prob += traffic_congestion * 0.15

        # Carrier reliability (inverse)
        delay_prob += (1 - carrier_reliability) * 0.2

        # Cargo sensitivity
        if cargo_type in ("perishable", "hazardous"):
            delay_prob += 0.08
        if cargo_type == "fragile":
            delay_prob += 0.04

        # Priority pressure
        if priority == "critical":
            delay_prob += 0.05

        # Time factors
        if hour in range(7, 10) or hour in range(17, 20):
            delay_prob += 0.06  # rush hours
        if day_of_week in (5, 6):
            delay_prob -= 0.03  # weekends less traffic

        # Add noise
        delay_prob += random.gauss(0, 0.08)
        delay_prob = max(0, min(1, delay_prob))

        # Compute delay duration (if delayed)
        is_delayed = 1 if random.random() < delay_prob else 0
        delay_hours = round(random.uniform(0.5, 48) * delay_prob, 1) if is_delayed else 0

        # Base ETA (based on distance and mode)
        speed_map = {"truck": 45, "rail": 55, "ship": 25, "air": 500}
        base_eta_hours = round(distance / speed_map.get(transport_mode, 45), 1)
        actual_eta_hours = base_eta_hours + delay_hours

        records.append({
            "shipment_id": f"SHP-{i:06d}",
            "origin": origin_city,
            "destination": dest_city,
            "origin_lat": o_lat,
            "origin_lng": o_lng,
            "dest_lat": d_lat,
            "dest_lng": d_lng,
            "distance_km": round(distance, 1),
            "cargo_type": cargo_type,
            "cargo_type_encoded": cargo_encoded,
            "cargo_weight_kg": cargo_weight,
            "transport_mode": transport_mode,
            "transport_mode_encoded": mode_encoded,
            "priority": priority,
            "priority_encoded": priority_encoded,
            "carrier": carrier,
            "carrier_reliability": carrier_reliability,
            "weather_condition": weather,
            "weather_risk": weather_risk,
            "traffic_congestion": traffic_congestion,
            "temperature": temperature,
            "hour_of_day": hour,
            "day_of_week": day_of_week,
            "month": month,
            "delay_probability": round(delay_prob, 4),
            "is_delayed": is_delayed,
            "delay_hours": delay_hours,
            "base_eta_hours": base_eta_hours,
            "actual_eta_hours": actual_eta_hours,
        })

    # Write CSV
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)

    print(f"Generated {num_samples} records -> {output_path}")
    return records


if __name__ == "__main__":
    generate_dataset(num_samples=10000)
