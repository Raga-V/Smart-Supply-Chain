# ============================================================
# Pub/Sub Topics & Subscriptions
# ============================================================

# ── Shipment Events (main ingestion topic) ───────────────────

resource "google_pubsub_topic" "shipment_events" {
  name    = "shipment-events"
  project = var.project_id

  message_retention_duration = "86400s" # 24 hours

  depends_on = [google_project_service.apis]
}

resource "google_pubsub_topic" "shipment_events_dlq" {
  name    = "shipment-events-dlq"
  project = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_pubsub_subscription" "shipment_events_sub" {
  name    = "shipment-events-sub"
  topic   = google_pubsub_topic.shipment_events.id
  project = var.project_id

  ack_deadline_seconds       = 30
  message_retention_duration = "604800s" # 7 days

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.shipment_events_dlq.id
    max_delivery_attempts = 5
  }

  depends_on = [google_project_service.apis]
}

# ── Risk Alerts ──────────────────────────────────────────────

resource "google_pubsub_topic" "risk_alerts" {
  name    = "risk-alerts"
  project = var.project_id

  message_retention_duration = "86400s"

  depends_on = [google_project_service.apis]
}

resource "google_pubsub_subscription" "risk_alerts_sub" {
  name    = "risk-alerts-sub"
  topic   = google_pubsub_topic.risk_alerts.id
  project = var.project_id

  ack_deadline_seconds       = 20
  message_retention_duration = "259200s" # 3 days

  depends_on = [google_project_service.apis]
}

# ── Decision Actions ─────────────────────────────────────────

resource "google_pubsub_topic" "decision_actions" {
  name    = "decision-actions"
  project = var.project_id

  message_retention_duration = "86400s"

  depends_on = [google_project_service.apis]
}

# ── Driver Updates ───────────────────────────────────────────

resource "google_pubsub_topic" "driver_updates" {
  name    = "driver-updates"
  project = var.project_id

  message_retention_duration = "43200s" # 12 hours

  depends_on = [google_project_service.apis]
}
