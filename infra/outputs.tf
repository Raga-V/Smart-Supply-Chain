# ============================================================
# Outputs
# ============================================================

output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "service_account_email" {
  value = google_service_account.main.email
}

output "pubsub_shipment_events_topic" {
  value = google_pubsub_topic.shipment_events.name
}

output "pubsub_risk_alerts_topic" {
  value = google_pubsub_topic.risk_alerts.name
}

output "bigquery_dataset" {
  value = google_bigquery_dataset.supply_chain.dataset_id
}

output "raw_data_bucket" {
  value = google_storage_bucket.raw_data.name
}

output "ml_artifacts_bucket" {
  value = google_storage_bucket.ml_artifacts.name
}

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}
