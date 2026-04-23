"""
Application configuration loaded from environment variables.
"""
import os
from typing import List


class Settings:
    """Centralized config — reads from env vars with sensible defaults."""

    # GCP
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "solutionchallenge-494200")
    GCP_REGION: str = os.getenv("GCP_REGION", "asia-south1")

    # Firebase — uses Application Default Credentials (no key file required)

    # Pub/Sub topics
    PUBSUB_SHIPMENT_EVENTS: str = os.getenv("PUBSUB_SHIPMENT_EVENTS", "shipment-events")
    PUBSUB_RISK_ALERTS: str = os.getenv("PUBSUB_RISK_ALERTS", "risk-alerts")
    PUBSUB_DECISION_ACTIONS: str = os.getenv("PUBSUB_DECISION_ACTIONS", "decision-actions")
    PUBSUB_DRIVER_UPDATES: str = os.getenv("PUBSUB_DRIVER_UPDATES", "driver-updates")

    # BigQuery
    BQ_DATASET: str = os.getenv("BQ_DATASET", "supply_chain")

    # ML Model Server
    MODEL_SERVER_URL: str = os.getenv(
        "MODEL_SERVER_URL", "http://localhost:8081"
    )

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = os.getenv(
        "GOOGLE_MAPS_API_KEY", "AIzaSyDuVNR4zO8eFQHUqPadO69jUNUjzPgPWTU"
    )

    # Cloud Storage
    RAW_DATA_BUCKET: str = os.getenv(
        "RAW_DATA_BUCKET", f"{GCP_PROJECT_ID}-raw-data-lake"
    )
    ML_ARTIFACTS_BUCKET: str = os.getenv(
        "ML_ARTIFACTS_BUCKET", f"{GCP_PROJECT_ID}-ml-artifacts"
    )

    # CORS
    ALLOWED_ORIGINS: List[str] = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000,https://*.web.app",
    ).split(",")

    # Risk threshold
    RISK_THRESHOLD: float = float(os.getenv("RISK_THRESHOLD", "0.7"))


settings = Settings()
