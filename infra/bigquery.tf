# ============================================================
# BigQuery Dataset & Tables
# ============================================================

resource "google_bigquery_dataset" "supply_chain" {
  dataset_id  = "supply_chain"
  project     = var.project_id
  location    = var.region
  description = "Supply Chain Intelligence Platform analytics dataset"

  default_table_expiration_ms = null # no expiration

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  depends_on = [google_project_service.apis]
}

# ── Shipments Table ──────────────────────────────────────────

resource "google_bigquery_table" "shipments" {
  dataset_id = google_bigquery_dataset.supply_chain.dataset_id
  table_id   = "shipments"
  project    = var.project_id

  time_partitioning {
    type  = "DAY"
    field = "created_at"
  }

  clustering = ["org_id", "status"]

  schema = jsonencode([
    { name = "shipment_id",    type = "STRING",    mode = "REQUIRED" },
    { name = "org_id",         type = "STRING",    mode = "REQUIRED" },
    { name = "origin",         type = "STRING",    mode = "REQUIRED" },
    { name = "destination",    type = "STRING",    mode = "REQUIRED" },
    { name = "origin_lat",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "origin_lng",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "dest_lat",       type = "FLOAT64",   mode = "NULLABLE" },
    { name = "dest_lng",       type = "FLOAT64",   mode = "NULLABLE" },
    { name = "status",         type = "STRING",    mode = "REQUIRED" },
    { name = "cargo_type",     type = "STRING",    mode = "NULLABLE" },
    { name = "cargo_weight",   type = "FLOAT64",   mode = "NULLABLE" },
    { name = "transport_mode", type = "STRING",    mode = "NULLABLE" },
    { name = "sla_deadline",   type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "risk_score",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "eta",            type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "created_at",     type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "updated_at",     type = "TIMESTAMP", mode = "NULLABLE" },
  ])

  deletion_protection = false
}

# ── Features Table ───────────────────────────────────────────

resource "google_bigquery_table" "features" {
  dataset_id = google_bigquery_dataset.supply_chain.dataset_id
  table_id   = "features"
  project    = var.project_id

  time_partitioning {
    type  = "DAY"
    field = "event_timestamp"
  }

  clustering = ["org_id", "shipment_id"]

  schema = jsonencode([
    { name = "feature_id",          type = "STRING",    mode = "REQUIRED" },
    { name = "shipment_id",         type = "STRING",    mode = "REQUIRED" },
    { name = "org_id",              type = "STRING",    mode = "REQUIRED" },
    { name = "delay_probability",   type = "FLOAT64",   mode = "NULLABLE" },
    { name = "route_congestion",    type = "FLOAT64",   mode = "NULLABLE" },
    { name = "weather_risk_index",  type = "FLOAT64",   mode = "NULLABLE" },
    { name = "carrier_reliability", type = "FLOAT64",   mode = "NULLABLE" },
    { name = "transit_volatility",  type = "FLOAT64",   mode = "NULLABLE" },
    { name = "distance_km",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "current_lat",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "current_lng",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "speed_kmh",          type = "FLOAT64",   mode = "NULLABLE" },
    { name = "temperature",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "event_timestamp",    type = "TIMESTAMP", mode = "REQUIRED" },
  ])

  deletion_protection = false
}

# ── Risk Scores Table ────────────────────────────────────────

resource "google_bigquery_table" "risk_scores" {
  dataset_id = google_bigquery_dataset.supply_chain.dataset_id
  table_id   = "risk_scores"
  project    = var.project_id

  time_partitioning {
    type  = "DAY"
    field = "evaluated_at"
  }

  clustering = ["org_id", "shipment_id"]

  schema = jsonencode([
    { name = "score_id",        type = "STRING",    mode = "REQUIRED" },
    { name = "shipment_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "org_id",          type = "STRING",    mode = "REQUIRED" },
    { name = "risk_score",      type = "FLOAT64",   mode = "REQUIRED" },
    { name = "risk_level",      type = "STRING",    mode = "REQUIRED" },
    { name = "risk_factors",    type = "STRING",    mode = "NULLABLE" },
    { name = "model_version",   type = "STRING",    mode = "NULLABLE" },
    { name = "confidence",      type = "FLOAT64",   mode = "NULLABLE" },
    { name = "evaluated_at",    type = "TIMESTAMP", mode = "REQUIRED" },
  ])

  deletion_protection = false
}

# ── Audit Logs Table ─────────────────────────────────────────

resource "google_bigquery_table" "audit_logs" {
  dataset_id = google_bigquery_dataset.supply_chain.dataset_id
  table_id   = "audit_logs"
  project    = var.project_id

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  clustering = ["org_id", "action"]

  schema = jsonencode([
    { name = "log_id",      type = "STRING",    mode = "REQUIRED" },
    { name = "org_id",      type = "STRING",    mode = "REQUIRED" },
    { name = "user_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "action",      type = "STRING",    mode = "REQUIRED" },
    { name = "resource",    type = "STRING",    mode = "NULLABLE" },
    { name = "resource_id", type = "STRING",    mode = "NULLABLE" },
    { name = "details",     type = "STRING",    mode = "NULLABLE" },
    { name = "ip_address",  type = "STRING",    mode = "NULLABLE" },
    { name = "timestamp",   type = "TIMESTAMP", mode = "REQUIRED" },
  ])

  deletion_protection = false
}

# ── Decisions Table ──────────────────────────────────────────

resource "google_bigquery_table" "decisions" {
  dataset_id = google_bigquery_dataset.supply_chain.dataset_id
  table_id   = "decisions"
  project    = var.project_id

  time_partitioning {
    type  = "DAY"
    field = "created_at"
  }

  clustering = ["org_id", "decision_type"]

  schema = jsonencode([
    { name = "decision_id",   type = "STRING",    mode = "REQUIRED" },
    { name = "shipment_id",   type = "STRING",    mode = "REQUIRED" },
    { name = "org_id",        type = "STRING",    mode = "REQUIRED" },
    { name = "decision_type", type = "STRING",    mode = "REQUIRED" },
    { name = "priority",      type = "INTEGER",   mode = "NULLABLE" },
    { name = "action",        type = "STRING",    mode = "NULLABLE" },
    { name = "rationale",     type = "STRING",    mode = "NULLABLE" },
    { name = "status",        type = "STRING",    mode = "REQUIRED" },
    { name = "approved_by",   type = "STRING",    mode = "NULLABLE" },
    { name = "cost_impact",   type = "FLOAT64",   mode = "NULLABLE" },
    { name = "time_impact",   type = "FLOAT64",   mode = "NULLABLE" },
    { name = "risk_before",   type = "FLOAT64",   mode = "NULLABLE" },
    { name = "risk_after",    type = "FLOAT64",   mode = "NULLABLE" },
    { name = "created_at",    type = "TIMESTAMP", mode = "REQUIRED" },
  ])

  deletion_protection = false
}
