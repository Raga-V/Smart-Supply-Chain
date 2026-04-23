# ============================================================
# Supply Chain Intelligence Platform — Core Terraform Config
# ============================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

# ── Providers ────────────────────────────────────────────────

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ── Enable Required APIs ─────────────────────────────────────

locals {
  required_apis = [
    "pubsub.googleapis.com",
    "dataflow.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
    "aiplatform.googleapis.com",
    "firebase.googleapis.com",
    "run.googleapis.com",
    "cloudfunctions.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "maps-backend.googleapis.com",
    "directions-backend.googleapis.com",
    "places-backend.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each           = toset(local.required_apis)
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# ── Artifact Registry (Docker images) ────────────────────────

resource "google_artifact_registry_repository" "docker" {
  provider      = google-beta
  location      = var.region
  repository_id = "supply-chain-images"
  format        = "DOCKER"
  description   = "Docker images for Supply Chain platform services"

  depends_on = [google_project_service.apis]
}
