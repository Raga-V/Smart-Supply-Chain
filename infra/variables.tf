# ============================================================
# Variables
# ============================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_name" {
  description = "GCP Project display name"
  type        = string
  default     = "SolutionChallenge"
}

variable "region" {
  description = "Default GCP region"
  type        = string
  default     = "asia-south1"
}

variable "zone" {
  description = "Default GCP zone"
  type        = string
  default     = "asia-south1-a"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "service_account_id" {
  description = "Service account ID for all services (Phase 1)"
  type        = string
  default     = "supply-chain-sa"
}
