# ⚡ SupplyChainAI — Resilient, Self-Healing Supply Chain Intelligence Platform

A production-grade, fully serverless, event-driven supply chain intelligence platform built on **Google Cloud** that predicts, prevents, and autonomously mitigates logistics disruptions in real time.

## 🏗️ Architecture

```
[IoT / APIs / GPS / Org Data]
          ↓
    Cloud Pub/Sub (Streaming)
          ↓
    Cloud Dataflow (Processing)
          ↓
  BigQuery + Feature Store
          ↓
    ML Models (LightGBM on Cloud Run)
          ↓
    Decision Engine (Optimization)
          ↓
  Cloud Run / Functions (Execution)
          ↓
  Dashboard (React + Maps + Firebase)
```

## 📂 Repository Structure

| Directory | Purpose |
|-----------|---------|
| `infra/` | Terraform IaC for GCP resources |
| `backend/` | FastAPI backend (Cloud Run) |
| `ml/` | ML model training & serving |
| `frontend/` | React dashboard (Firebase Hosting) |
| `functions/` | Cloud Functions (event-driven) |
| `dataflow/` | Stream processing pipelines |
| `.github/` | CI/CD workflows |

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Google Cloud SDK (`gcloud`)
- Terraform 1.5+

### Local Development

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# ML Model Server
cd ml
pip install -r serving/requirements.txt
python data/generate_synthetic.py
python training/train_delay_model.py
uvicorn serving.model_server:app --port 8081
```

## 🔐 RBAC Roles

| Role | Permissions |
|------|------------|
| **Admin** | Full control, approvals, overrides |
| **Manager** | Decision approval, monitoring |
| **Analyst** | Data insights, reporting |
| **Fleet Manager** | Fleet operations |
| **Driver** | Execution-level updates, alerts |

## 📊 Key Features

- ✅ Multi-tenant organization onboarding
- ✅ Role-based access control (RBAC)
- ✅ Shipment lifecycle management
- ✅ Pre-dispatch risk evaluation (ML-powered)
- ✅ Real-time dashboard with risk metrics
- ✅ Alert system for high-risk shipments
- ✅ Fleet & warehouse management
- ✅ Internal messaging system
- ✅ Analytics & performance tracking

## 🔧 GCP Services Used

Pub/Sub • Dataflow • BigQuery • Cloud Storage • Cloud Run • Cloud Functions • Firebase Auth • Firestore • Firebase Hosting • Artifact Registry • Google Maps Platform

## 📄 License

MIT
