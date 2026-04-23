# ============================================================
# IAM — Service Account & Bindings
# ============================================================

resource "google_service_account" "main" {
  account_id   = var.service_account_id
  display_name = "Supply Chain Platform SA (Phase 1)"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

# ── IAM Role Bindings ────────────────────────────────────────

locals {
  sa_roles = [
    "roles/pubsub.publisher",
    "roles/pubsub.subscriber",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/storage.objectAdmin",
    "roles/dataflow.worker",
    "roles/run.invoker",
    "roles/cloudfunctions.invoker",
    "roles/aiplatform.user",
    "roles/firebaseauth.admin",
    "roles/datastore.user",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ]
}

resource "google_project_iam_member" "sa_bindings" {
  for_each = toset(local.sa_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.main.email}"
}
