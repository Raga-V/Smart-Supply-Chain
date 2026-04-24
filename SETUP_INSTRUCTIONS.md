# ⚡ SupplyChainAI — Phase 1 Cloud Setup Guide

Complete step-by-step instructions to deploy the Supply Chain Intelligence Platform on Google Cloud.

> **Authentication approach:** This project uses **Application Default Credentials (ADC)** exclusively.
> No service account key files are generated or required. The project enforces
> `constraints/iam.disableServiceAccountKeyCreation`.

---

## Prerequisites

Before starting, ensure you have:

- [x] A Google Cloud account with billing enabled
- [x] GCP Project: `solutionchallenge-494200`
- [x] Google Cloud SDK (`gcloud`) installed — [Install Guide](https://cloud.google.com/sdk/docs/install)
- [x] Terraform 1.5+ installed — [Install Guide](https://developer.hashicorp.com/terraform/install)
- [x] Node.js 20+ and npm
- [x] Python 3.11+
- [x] Git installed

---

## STEP 1: Authenticate with Google Cloud

Open a terminal and run:

```bash
# Login to your Google account
gcloud auth login

# Set Application Default Credentials for local development
# This is what ALL SDKs (Firebase Admin, Cloud libraries) will use locally
gcloud auth application-default login

# Set the active project
gcloud config set project solutionchallenge-494200

# Set default region
gcloud config set compute/region asia-south1

# Verify
gcloud config list
```

**Expected output:** You should see `project = solutionchallenge-494200` and `region = asia-south1`.

> **Why `application-default login`?** This creates credentials at
> `~/.config/gcloud/application_default_credentials.json` that all Google SDKs
> (Python, Node.js, Go) automatically discover. No environment variable needed.

---

## STEP 2: Enable Required APIs

Run this single command to enable all APIs needed:

```bash
gcloud services enable \
  pubsub.googleapis.com \
  dataflow.googleapis.com \
  bigquery.googleapis.com \
  storage.googleapis.com \
  aiplatform.googleapis.com \
  firebase.googleapis.com \
  run.googleapis.com \
  cloudfunctions.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  maps-backend.googleapis.com \
  directions-backend.googleapis.com \
  places-backend.googleapis.com
```

> **Note:** This may take 1-2 minutes. Some APIs may already be enabled.

---

## STEP 3: Set Up Firebase

### 3a. Initialize Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Select your existing GCP project: **SolutionChallenge** (`solutionchallenge-494200`)
4. Follow the wizard (you can skip Google Analytics for now)
5. Click **Create Project**

### 3b. Enable Firebase Authentication

1. In Firebase Console → **Build** → **Authentication**
2. Click **Get Started**
3. Go to **Sign-in method** tab
4. Enable these providers:
   - **Email/Password** — Click, toggle ON, Save
   - **Google** — Click, toggle ON, set support email, Save

### 3c. Create Firestore Database

1. In Firebase Console → **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll add security rules later)
4. Select location: **asia-south1 (Mumbai)**
5. Click **Enable**

### 3d. Get Firebase Config for Frontend

1. In Firebase Console → **Project Settings** (gear icon)
2. Scroll down to **"Your apps"** section
3. Click the **Web** icon (`</>`) to add a web app
4. Register app name: `SupplyChainAI Dashboard`
5. **Do NOT** check "Firebase Hosting" yet
6. Click **Register app**
7. You'll see a config object like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "solutionchallenge-494200.firebaseapp.com",
  projectId: "solutionchallenge-494200",
  storageBucket: "solutionchallenge-494200.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

8. **Save these values!** You'll need them for the `.env` file in Step 7.

### 3e. Set Firestore Security Rules

1. In Firebase Console → **Firestore Database** → **Rules** tab
2. Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only backend writes
    }

    // Organization data scoped by org_id
    match /organizations/{orgId} {
      allow read: if request.auth != null && request.auth.token.org_id == orgId;
      allow write: if false;

      match /{subcollection}/{docId} {
        allow read: if request.auth != null && request.auth.token.org_id == orgId;
        allow write: if false;
      }
    }

    // Shipments scoped by org_id
    match /shipments/{shipmentId} {
      allow read: if request.auth != null &&
        resource.data.org_id == request.auth.token.org_id;
      allow write: if false;
    }
  }
}
```

3. Click **Publish**

---

## STEP 4: Create Service Account (No Key File)

The service account is used by Cloud Run, Cloud Functions, and Terraform — but
we **never download a key**. Authentication happens via ADC locally and attached
service accounts in production.

```bash
# Create the service account
gcloud iam service-accounts create supply-chain-sa \
  --display-name="Supply Chain Platform SA (Phase 1)" \
  --project=solutionchallenge-494200

# Grant required roles
ROLES=(
  "roles/pubsub.publisher"
  "roles/pubsub.subscriber"
  "roles/bigquery.dataEditor"
  "roles/bigquery.jobUser"
  "roles/storage.objectAdmin"
  "roles/dataflow.worker"
  "roles/run.invoker"
  "roles/cloudfunctions.invoker"
  "roles/aiplatform.user"
  "roles/firebaseauth.admin"
  "roles/datastore.user"
  "roles/logging.logWriter"
  "roles/monitoring.metricWriter"
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding solutionchallenge-494200 \
    --member="serviceAccount:supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com" \
    --role="$ROLE" \
    --quiet
done
```

> **⚠️ No key file is created.** The `constraints/iam.disableServiceAccountKeyCreation`
> policy is enforced. All code uses ADC.

**Verify the SA was created:**
```bash
gcloud iam service-accounts list --project=solutionchallenge-494200
```

### How authentication works

| Environment | How it authenticates |
|-------------|---------------------|
| **Local dev** | `gcloud auth application-default login` (your Google account) |
| **Cloud Run** | `--service-account=supply-chain-sa@...` (attached SA) |
| **Cloud Functions** | `--service-account=supply-chain-sa@...` (attached SA) |
| **GitHub Actions** | Workload Identity Federation (see Step 10) |

---

## STEP 5: Provision Infrastructure with Terraform

```bash
cd infra

# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Apply (type 'yes' when prompted)
terraform apply
```

**What this creates:**
- 4 Pub/Sub topics + subscriptions + dead-letter queues
- BigQuery dataset `supply_chain` with 5 tables
- 3 Cloud Storage buckets
- Artifact Registry for Docker images
- Service account IAM bindings

**Expected time:** ~2-3 minutes

**Verify:**
```bash
# Check Pub/Sub topics
gcloud pubsub topics list

# Check BigQuery dataset
bq ls supply_chain

# Check Storage buckets
gcloud storage ls
```

---

## STEP 6: Train & Deploy ML Model

```bash
cd ml

# Install Python dependencies
pip install -r serving/requirements.txt
pip install pandas scikit-learn lightgbm

# Generate synthetic training data
python data/generate_synthetic.py

# Train the delay prediction model
python training/train_delay_model.py

# Verify model artifacts were created
dir serving\model_artifacts
# Should see: delay_classifier.pkl, delay_regressor.pkl, model_metadata.json
```

### Deploy Model Server to Cloud Run

```bash
cd ml/serving

# Build Docker image
gcloud builds submit \
  --tag asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/model-server:v1

# Deploy to Cloud Run with the service account attached
gcloud run deploy model-server \
  --image asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/model-server:v1 \
  --platform managed \
  --region asia-south1 \
  --memory 1Gi \
  --allow-unauthenticated \
  --service-account=supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com \
  --set-env-vars MODEL_DIR=/app/model_artifacts
```

**Save the model server URL** (shown after deploy). It looks like:
`https://model-server-xxxxx-el.a.run.app`
https://model-server-183345942117.asia-south1.run.app

---

## STEP 7: Deploy Backend API to Cloud Run

### 7a. Create Environment File

Create `backend/.env` (for local dev only — Cloud Run uses env vars directly):

```env
GCP_PROJECT_ID=solutionchallenge-494200
GCP_REGION=asia-south1
MODEL_SERVER_URL=https://model-server-xxxxx-el.a.run.app
GOOGLE_MAPS_API_KEY=AIzaSyDuVNR4zO8eFQHUqPadO69jUNUjzPgPWTU
RISK_THRESHOLD=0.7
```

> **Note:** No `FIREBASE_CREDENTIALS_PATH` needed. The backend uses
> `firebase_admin.initialize_app()` which automatically picks up ADC.

### 7b. Deploy to Cloud Run

```bash
cd backend

# Build and push image
gcloud builds submit \
  --tag asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:v1

# Deploy with attached service account (no key file needed)
gcloud run deploy supply-chain-api \
  --image asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:v1 \
  --platform managed \
  --region asia-south1 \
  --memory 512Mi \
  --allow-unauthenticated \
  --service-account=supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com \
  --set-env-vars GCP_PROJECT_ID=solutionchallenge-494200,GCP_REGION=asia-south1,MODEL_SERVER_URL=https://model-server-xxxxx-el.a.run.app,GOOGLE_MAPS_API_KEY=AIzaSyDuVNR4zO8eFQHUqPadO69jUNUjzPgPWTU
```

**Save the API URL** (e.g., `https://supply-chain-api-xxxxx-el.a.run.app`).

**Verify:**
```bash
curl https://supply-chain-api-xxxxx-el.a.run.app/
https://supply-chain-api-183345942117.asia-south1.run.app
# Should return: {"status":"healthy","service":"Supply Chain Intelligence API","version":"1.0.0"}
```

---

## STEP 8: Deploy Cloud Functions

### Risk Evaluator

```bash
cd functions/risk_evaluator

gcloud functions deploy risk-evaluator \
  --gen2 \
  --runtime python311 \
  --region asia-south1 \
  --trigger-topic shipment-events \
  --entry-point evaluate_risk \
  --memory 256Mi \
  --timeout 60s \
  --service-account supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com
```

### Alert Notifier

```bash
cd functions/alert_notifier

gcloud functions deploy alert-notifier \
  --gen2 \
  --runtime python311 \
  --region asia-south1 \
  --trigger-topic risk-alerts \
  --entry-point notify_alert \
  --memory 256Mi \
  --timeout 30s \
  --service-account supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com
```

**Verify:**
```bash
gcloud functions list --region asia-south1
# Should show: risk-evaluator, alert-notifier
```

---

## STEP 9: Deploy Frontend to Firebase Hosting

### 9a. Create Frontend Environment File

Create `frontend/.env`:

```env
VITE_API_URL=https://supply-chain-api-xxxxx-el.a.run.app
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_PROJECT_ID=solutionchallenge-494200
VITE_FIREBASE_APP_ID=your-firebase-app-id
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
```

> Replace with the values from Step 3d.

### 9b. Initialize Firebase Hosting

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize hosting (run from the Prototype root)
cd "c:\Gowtami\Solution Challenge\Prototype"
firebase init hosting
```

When prompted:
- **Project:** Select `solutionchallenge-494200`
- **Public directory:** `frontend/dist`
- **Single-page app (rewrite all URLs to /index.html):** **Yes**
- **GitHub auto deploys:** No (we have our own CI/CD)

### 9c. Build and Deploy

```bash
cd frontend

# Build production bundle
npm run build

# Deploy to Firebase Hosting
cd ..
firebase deploy --only hosting
```

**Your app will be live at:** `https://solutionchallenge-494200.web.app`

---

## STEP 10: Set Up GitHub Secrets for CI/CD

Since we can't use key files, use **Workload Identity Federation** for GitHub Actions.

### 10a. Set Up Workload Identity Federation

```bash
# Create a Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project="solutionchallenge-494200" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create a Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="solutionchallenge-494200" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub OIDC Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow the GitHub repo to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  "supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com" \
  --project="solutionchallenge-494200" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe solutionchallenge-494200 --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/Raga-V/Smart-Supply-Chain"
```

### 10b. Add GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**

| Secret Name | Value |
|------------|-------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com` |
| `API_URL` | Backend Cloud Run URL (from Step 7b) |
| `FIREBASE_API_KEY` | Firebase API key (from Step 3d) |

> Get your project number with:
> `gcloud projects describe solutionchallenge-494200 --format='value(projectNumber)'`

---

## STEP 11: Push to GitHub

```bash
cd "c:\Gowtami\Solution Challenge\Prototype"

git init
git remote add origin https://github.com/Raga-V/Smart-Supply-Chain.git
git add .
git commit -m "Phase 1: Complete supply chain intelligence platform"
git branch -M main
git push -u origin main
```

---

## ✅ Verification Checklist

After completing all steps, verify each component:

| # | Check | Command / URL | Expected Result |
|---|-------|---------------|-----------------|
| 1 | APIs enabled | `gcloud services list --enabled` | 15+ APIs listed |
| 2 | Firebase Auth | Firebase Console → Auth | Email + Google providers ON |
| 3 | Firestore | Firebase Console → Firestore | Database created in asia-south1 |
| 4 | Service account | `gcloud iam service-accounts list` | `supply-chain-sa` exists |
| 5 | Pub/Sub topics | `gcloud pubsub topics list` | 4 topics + 1 DLQ |
| 6 | BigQuery tables | `bq ls supply_chain` | 5 tables |
| 7 | Storage buckets | `gcloud storage ls` | 3 buckets |
| 8 | Model server | `curl <model-server-url>/` | `{"status":"healthy","model_loaded":true}` |
| 9 | Backend API | `curl <api-url>/` | `{"status":"healthy"}` |
| 10 | Cloud Functions | `gcloud functions list` | 2 functions |
| 11 | Frontend | Open `*.web.app` URL | Login page loads |
| 12 | End-to-end | Sign up → Create org → Create shipment | Risk score displayed |

---

## 💰 Cost Estimates (Phase 1)

| Service | Monthly Cost (approx) |
|---------|----------------------|
| Cloud Run (API + Model) | $0 (free tier: 2M requests) |
| Firestore | $0 (free tier: 1GB storage) |
| Pub/Sub | $0 (free tier: 10GB/month) |
| BigQuery | $0 (free tier: 1TB queries) |
| Cloud Storage | $0 (free tier: 5GB) |
| Cloud Functions | $0 (free tier: 2M invocations) |
| Firebase Auth | $0 (free: 50K users) |
| Firebase Hosting | $0 (free: 10GB/month) |
| **Total** | **~$0/month** (within free tiers) |

---

## 🔧 Troubleshooting

### "Permission denied" or ADC errors locally
```bash
# Re-authenticate ADC
gcloud auth application-default login

# Verify your active account
gcloud auth list

# Verify project is set
gcloud config get-value project
```

### "Could not load the default credentials" in Python/Node.js
```bash
# Make sure ADC is set up
gcloud auth application-default login

# Verify the credentials file exists
# Windows: %APPDATA%\gcloud\application_default_credentials.json
# Linux/Mac: ~/.config/gcloud/application_default_credentials.json
```

### Terraform state issues
```bash
cd infra
terraform init -reconfigure
```

### Firebase Auth not working
- Verify your domain is added to **Authorized domains** in Firebase Console → Auth → Settings
- Add `localhost` and `*.web.app` to the list

### Cloud Run cold starts
- First request may take 5-10 seconds (cold start)
- Subsequent requests will be fast

### CORS errors in browser
- Verify the backend `ALLOWED_ORIGINS` includes your Firebase Hosting URL
- Add it to the env var: `ALLOWED_ORIGINS=https://solutionchallenge-494200.web.app,http://localhost:5173`

---

## 🚀 Phases 2 · 3 · 4 — Unified Deployment Guide

Run all commands below **in order**. Everything from real-time GPS → self-healing decisions → digital twin simulation is covered here.

---

### What was built across all phases

| Phase | Area | New files |
|-------|------|-----------|
| 2 | GPS Simulation | `backend/app/services/gps_simulator.py` |
| 2 | Streaming API | `backend/app/routers/streaming.py` |
| 2 | Analytics API | `backend/app/routers/analytics.py` |
| 2 | Messages (enhanced) | unread count, threads, mark-as-read |
| 2 | Shipments (enhanced) | `/location` `/gps-track` `/events` |
| 2 | Firestore helpers | `update_org_document`, `list_subcollection` |
| 2 | Live Tracking page | SVG India map, real-time markers, sim controls |
| 2 | Analytics page | Recharts: risk trend, delays, carriers, forecast |
| 2 | Dashboard (real-time) | `onSnapshot` — zero-polling live stats |
| 2 | Shipment Detail (enhanced) | GPS breadcrumbs, events timeline, sim controls |
| 2 | Messages (real-time) | `onSnapshot`, thread sidebar, unread badges |
| 3 | Decision Engine | `backend/app/services/decision_engine.py` |
| 3 | Decisions API | `backend/app/routers/decisions.py` |
| 3 | Decisions page | Approval workflow, cascade cards, impact KPIs |
| 4 | Digital Twin API | `backend/app/routers/digital_twin.py` |
| 4 | Digital Twin page | Monte Carlo simulator, mode comparison, risk timeline |

---

### STEP 1 — Install frontend dependencies

```bash
cd "c:\Gowtami\Solution Challenge\Prototype\frontend"
npm install recharts --save
```

---

### STEP 2 — Verify local dev (optional but recommended)

```bash
# Terminal 1 — frontend
cd "c:\Gowtami\Solution Challenge\Prototype\frontend"
npm run dev
# → http://localhost:5173

# Terminal 2 — backend (if running locally)
cd "c:\Gowtami\Solution Challenge\Prototype\backend"
uvicorn app.main:app --reload --port 8080
```

Open http://localhost:5173 and check:
- ✅ Sidebar shows: Live Map · Decisions · Digital Twin
- ✅ Dashboard stats update without refresh
- ✅ Live Tracking page loads SVG map with city dots
- ✅ Analytics page loads charts
- ✅ Digital Twin → Run Simulation produces results

---

### STEP 3 — Redeploy backend to Cloud Run (v2 with all phases)

```powershell
cd "c:\Gowtami\Solution Challenge\Prototype\backend"

# Build container image
gcloud builds submit `
  --tag asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:v2 `
  --project solutionchallenge-494200

# Deploy to Cloud Run
gcloud run deploy supply-chain-api `
  --image asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:v2 `
  --platform managed `
  --region asia-south1 `
  --memory 512Mi `
  --cpu 1 `
  --max-instances 10 `
  --allow-unauthenticated `
  --service-account=supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com `
  --set-env-vars "GCP_PROJECT_ID=solutionchallenge-494200,GCP_REGION=asia-south1,MODEL_SERVER_URL=https://model-server-183345942117.asia-south1.run.app,GOOGLE_MAPS_API_KEY=AIzaSyDuVNR4zO8eFQHUqPadO69jUNUjzPgPWTU" `
  --project solutionchallenge-494200
```

**Verify all new endpoints:**

1. Open your frontend: `http://localhost:5173` or `https://solutionchallenge-494200.web.app`
2. Log in with any account
3. Open Developer Tools (F12) -> Console
4. Run: `console.log(window.__fbToken)` and copy the output string

```powershell
$BASE = "https://supply-chain-api-183345942117.asia-south1.run.app"
$TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjNiMDk1NzQ3YmY4MzMxZWE0YWQ1M2YzNzBjNjMyNjAxNzliMGQyM2EiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiUmFnYSBHb3d0YW1pIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0lWVFRGNW9HME5uamI4ejRvZmdEQkNjdTBWaEFEZDRabzdIQ1NreUxBcHdoQUdfNzMxPXM5Ni1jIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3NvbHV0aW9uY2hhbGxlbmdlLTQ5NDIwMCIsImF1ZCI6InNvbHV0aW9uY2hhbGxlbmdlLTQ5NDIwMCIsImF1dGhfdGltZSI6MTc3NzAwODMwNywidXNlcl9pZCI6IkJwVUtvcUtyRHhja0NremRwMHJxNHNJdDAweDIiLCJzdWIiOiJCcFVLb3FLckR4Y2tDa3pkcDBycTRzSXQwMHgyIiwiaWF0IjoxNzc3MDE0NjA5LCJleHAiOjE3NzcwMTgyMDksImVtYWlsIjoicmFnYWdvd3RhbWl2aW5qYW5hbXBhdGlAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMTQ5MzQ5Nzk4ODk4MzA2NTc4MjkiXSwiZW1haWwiOlsicmFnYWdvd3RhbWl2aW5qYW5hbXBhdGlAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.bzNC-gpAi3AHfrWcqdBNpIjxMI4PejwrDOIOGyiJ9_Xyw5I_ijwIU1Q1IeLmqZ2enCMF78C4MLirqXpNIbJE_S6wwUHtTA7hK8IHesNH2D5nV2xvC6wBeazCw-m-t2R0uexPC7qqzManRkXsuOoiXquYT-iZk0MChh-PsljYTVA-eY5LUf4AKbZZgoX0ev8FcN-WPOlYP6Dp4W_0u_RKyVWK6GTIlEuAOLmrutUKDWLakww3QEqEkB7oN_dUyWCWRWpVRk9_E1LNY5Coq-rwuUYqLFXtnFAHSS5ZDc_gR-C6n3WjjTHoxeVg9c9qWFSoPMWQHtEdfqFx2h8-k81PeQ"
$HEADERS = @{ Authorization = "Bearer $TOKEN" }

# Phase 2 — Analytics
Invoke-RestMethod "$BASE/api/analytics/overview" -Headers $HEADERS
Invoke-RestMethod "$BASE/api/analytics/risk-timeline" -Headers $HEADERS
Invoke-RestMethod "$BASE/api/streaming/active" -Headers $HEADERS

# Phase 4 — Digital Twin
$body = @{
  origin_name = "Mumbai"; destination_name = "Delhi"
  origin_lat = 19.076; origin_lng = 72.877
  destination_lat = 28.613; destination_lng = 77.209
  transport_mode = "truck"; cargo_type = "general"
  cargo_weight_kg = 5000; delivery_deadline_days = 3
  n_scenarios = 50
} | ConvertTo-Json
Invoke-RestMethod -Uri "$BASE/api/digital-twin/simulate" -Method Post -Body $body -ContentType "application/json" -Headers $HEADERS

# Browse all endpoints
Start-Process "$BASE/docs"
```

---

### STEP 4 — Update Firestore Security Rules

Open Firebase Console → Firestore → Rules tab and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }

    match /organizations/{orgId} {
      allow read: if request.auth != null
        && request.auth.token.org_id == orgId;
      allow write: if false;

      match /{subcollection}/{docId} {
        allow read: if request.auth != null
          && request.auth.token.org_id == orgId;
        allow write: if false;
      }
    }

    match /shipments/{shipmentId} {
      allow read: if request.auth != null
        && resource.data.org_id == request.auth.token.org_id;
      allow write: if false;

      match /gps_track/{pointId} {
        allow read: if request.auth != null;
        allow write: if false;
      }
      match /events/{eventId} {
        allow read: if request.auth != null;
        allow write: if false;
      }
    }

    match /decisions/{decisionId} {
      allow read: if request.auth != null
        && resource.data.org_id == request.auth.token.org_id;
      allow write: if false;
    }
  }
}
```

Click **Publish**.

---

### STEP 5 — Build and deploy frontend

```powershell
cd "c:\Gowtami\Solution Challenge\Prototype\frontend"

# Production build
npm run build

# Deploy to Firebase Hosting
cd "c:\Gowtami\Solution Challenge\Prototype"
npx -y firebase-tools@latest deploy --only hosting --project solutionchallenge-494200
```

**Live app:** `https://solutionchallenge-494200.web.app`

---

### STEP 6 — End-to-end test walkthrough

Perform these steps in your live app after deployment:

#### Phase 2 — Real-Time GPS
1. Login as admin → go to **Shipments** → create a new shipment (Mumbai → Delhi, truck)
2. Open the shipment → click **"Start Live GPS Simulation"**
3. Go to **Live Map** — the vehicle marker should appear and move every ~15 seconds
4. Watch the **Dashboard** — at-risk count and in-transit stats update automatically (no F5!)
5. Go to **Messages** → send a message → it should appear instantly in all tabs

#### Phase 3 — Self-Healing Decisions
6. Go to **Decisions** page
7. From the dropdown, select the shipment you created (or any at-risk one)
8. Click **"Generate Decision"** — the AI cascade runs instantly
9. If "pending_approval": review the 4-tier options (reroute/mode_switch/consolidate/safe_halt)
10. Click **Approve & Execute** → the shipment's risk score updates automatically
11. Check **Impact Summary** KPIs — delays prevented / cost saved should increment

#### Phase 4 — Digital Twin
12. Go to **Digital Twin** page
13. Select route preset "Mumbai → Delhi", mode: truck, cargo: perishable, deadline: 2 days
14. Click **Run Simulation** (200 scenarios)
15. Review the PROCEED / CAUTION / CONSIDER_ALTERNATIVE banner
16. Check delivery P10/P50/P90 vs deadline line
17. Compare mode alternatives — does Air give better on-time %?
18. Change to "hazardous" cargo → risk should spike significantly

---

### ✅ Full Verification Checklist

| # | Endpoint / Page | Expected result |
|---|-----------------|-----------------|
| 1 | `GET /api/analytics/overview` | `{"total_shipments": N, "on_time_rate": ...}` |
| 2 | `GET /api/analytics/risk-timeline` | 30-item array of `{date, avg_risk}` |
| 3 | `GET /api/analytics/carrier-performance` | 7 carriers ranked by reliability |
| 4 | `GET /api/analytics/delay-forecast` | 7-day forecast with confidence bands |
| 5 | `GET /api/streaming/active` | `{"active_simulations": [], "count": 0}` |
| 6 | `POST /api/digital-twin/simulate` | `{"recommendation": "PROCEED/CAUTION/..."}` |
| 7 | `GET /api/decisions/pending` | `{"decisions": [], "count": 0}` (initially) |
| 8 | `GET /api/decisions/impact-summary` | Impact KPIs object |
| 9 | Live Tracking page | SVG map with city dots, filter chips work |
| 10 | Start GPS simulation | Marker moves on SVG map within 20s |
| 11 | Dashboard auto-update | Stats change without page refresh |
| 12 | Messages real-time | Sent message appears immediately |
| 13 | Analytics charts | All 4 tabs render Recharts charts |
| 14 | Digital Twin simulation | Results appear with charts in <3s |
| 15 | Decisions generate | 4-tier cascade cards appear |
| 16 | Decision approve | Shipment risk score updates in Firestore |
| 17 | Shipment detail GPS | Breadcrumb table + progress bar |
| 18 | Shipment detail events | Disruption event timeline (when sim active) |

---

### Troubleshooting

#### `ModuleNotFoundError` on Cloud Run
The new routers (`decisions`, `digital_twin`, `streaming`, `analytics`) are in the same package — no pip dependencies needed. If you see import errors, ensure `app/services/decision_engine.py` and `app/routers/digital_twin.py` are committed.

#### GPS simulation not moving
- Confirm the shipment has `origin_lat/lng` and `destination_lat/lng` — the simulator needs coordinates
- Check `GET /api/streaming/active` to confirm the simulation started
- Firestore `onSnapshot` needs the browser tab to stay open

#### Analytics charts blank / empty
- The analytics router has demo fallbacks — if you see blank charts, the API might be returning 401
- Ensure your Firebase token is valid: check browser DevTools → Network tab for the `/api/analytics/overview` call

#### Digital Twin returns 422
- All 7 required fields must be present: `origin_name`, `destination_name`, `origin_lat`, `origin_lng`, `destination_lat`, `destination_lng`, `transport_mode`

#### Decisions page shows empty
- Decisions require at least one shipment. Create a shipment first, then generate a decision
- Check `/api/decisions/pending` in the browser to confirm Firestore write succeeded

#### CORS errors
- Add your Firebase Hosting URL to `ALLOWED_ORIGINS`:
  ```
  ALLOWED_ORIGINS=https://solutionchallenge-494200.web.app,http://localhost:5173
  ```

---

## 🔒 Phase 5: Production Hardening

Phase 5 adds system monitoring, SLA compliance reports, CSV exports, and GitHub Actions CI/CD pipelines for zero-touch deployments.

### What was added in Phase 5

| Component | Description |
|-----------|-------------|
| `backend/app/routers/monitoring.py` | Health check, latency metrics (P50/P95/P99), SLA compliance, alert log, activity feed |
| `backend/app/routers/reports.py` | Org summary report, CSV export for shipments & decisions |
| `frontend/src/pages/MonitoringPage.jsx` | Live system health dashboard with 24h traffic + latency charts |
| `frontend/src/pages/ReportsPage.jsx` | SLA trend chart, decision breakdown, business impact, CSV download |
| `.github/workflows/backend.yml` | Auto-deploy backend to Cloud Run on push to `main` |
| `.github/workflows/frontend.yml` | Auto-build + Firebase Hosting deploy on push to `main` |

---

### PHASE 5 — Deploy Monitoring & Reports Backend

These routers are already registered in `main.py`. Redeploy with:

```powershell
cd "c:\Gowtami\Solution Challenge\Prototype\backend"

# Build v3 image with Phase 5 routers
gcloud builds submit `
  --tag asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:v3 `
  --project solutionchallenge-494200

gcloud run deploy supply-chain-api `
  --image asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:v3 `
  --platform managed --region asia-south1 --memory 512Mi `
  --allow-unauthenticated `
  --service-account=supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com `
  --set-env-vars "GCP_PROJECT_ID=solutionchallenge-494200,GCP_REGION=asia-south1,MODEL_SERVER_URL=https://model-server-183345942117.asia-south1.run.app,GOOGLE_MAPS_API_KEY=AIzaSyDuVNR4zO8eFQHUqPadO69jUNUjzPgPWTU" `
  --project solutionchallenge-494200
```

**Smoke test Phase 5 endpoints (Requires Authentication):**

Because these endpoints require authentication, you first need to get a valid Firebase ID token:
1. Open the live app (`https://solutionchallenge-494200.web.app`) or local frontend (`http://localhost:5173`)
2. Log in with any account
3. Open Developer Tools (F12) -> Console
4. Run: `console.log(window.__fbToken)` and copy the output string

Then, use it in your PowerShell commands like this:
```powershell
$BASE = "https://supply-chain-api-183345942117.asia-south1.run.app"
$TOKEN = "PASTE_YOUR_TOKEN_HERE"
$HEADERS = @{ Authorization = "Bearer $TOKEN" }

Invoke-RestMethod -Uri "$BASE/api/monitoring/health" -Headers $HEADERS
# → {"status": "healthy", "uptime_seconds": ..., "firestore": "connected"}

Invoke-RestMethod -Uri "$BASE/api/monitoring/metrics" -Headers $HEADERS
# → latency P50/P95/P99, hourly traffic, top endpoints

Invoke-RestMethod -Uri "$BASE/api/monitoring/sla" -Headers $HEADERS
# → on_time_pct, sla_compliant, 30-day trend
```

---

### PHASE 5 — Set Up GitHub Actions CI/CD

After pushing code to GitHub, auto-deployments will trigger on every push to `main`.

**Required GitHub Secrets** (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `WIF_PROVIDER` | Workload Identity Federation provider resource name |
| `MODEL_SERVER_URL` | `https://model-server-183345942117.asia-south1.run.app` |
| `GOOGLE_MAPS_API_KEY` | `AIzaSyDuVNR4zO8eFQHUqPadO69jUNUjzPgPWTU` |
| `FIREBASE_API_KEY` | Firebase Web API key |
| `FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console |
| `FIREBASE_APP_ID` | From Firebase Console |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON (for Firebase Hosting deploy) |

**Set up Workload Identity Federation** (one-time, keyless auth):
```powershell
# Create WIF pool
gcloud iam workload-identity-pools create "github-pool" `
  --project solutionchallenge-494200 `
  --location global `
  --display-name "GitHub Actions Pool"

# Create OIDC provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" `
  --project solutionchallenge-494200 `
  --location global `
  --workload-identity-pool "github-pool" `
  --display-name "GitHub Provider" `
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" `
  --issuer-uri "https://token.actions.githubusercontent.com"

# Grant service account access
gcloud iam service-accounts add-iam-policy-binding `
  supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com `
  --project solutionchallenge-494200 `
  --role roles/iam.workloadIdentityUser `
  --member "principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/Raga-V/Smart-Supply-Chain"

# Get the WIF_PROVIDER value to paste as secret
gcloud iam workload-identity-pools providers describe github-provider `
  --project solutionchallenge-494200 `
  --location global `
  --workload-identity-pool github-pool `
  --format "value(name)"
```

After adding all secrets, push to `main` — GitHub Actions will automatically:
1. Build the backend Docker image via Cloud Build
2. Deploy it to Cloud Run
3. Verify health via `/api/monitoring/health`
4. Build the React frontend with Vite
5. Deploy to Firebase Hosting

---

## 🚀 COMPLETE ONE-SHOT DEPLOYMENT (Phases 2–5)

Run these commands **in order** to go from code to production in one session:

```powershell
# ── 0. From the project root ──────────────────────────────────
cd "c:\Gowtami\Solution Challenge\Prototype"

# ── 1. Install frontend dependencies ─────────────────────────
cd frontend
npm install recharts --save
cd ..

# ── 2. Build frontend ─────────────────────────────────────────
cd frontend
npm run build
cd ..

# ── 3. Deploy backend (ALL phases 2-5) ───────────────────────
cd backend
gcloud builds submit `
  --tag asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:latest `
  --project solutionchallenge-494200

gcloud run deploy supply-chain-api `
  --image asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:latest `
  --platform managed --region asia-south1 --memory 512Mi --cpu 1 --max-instances 10 `
  --allow-unauthenticated `
  --service-account=supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com `
  --set-env-vars "GCP_PROJECT_ID=solutionchallenge-494200,GCP_REGION=asia-south1,MODEL_SERVER_URL=https://model-server-183345942117.asia-south1.run.app,GOOGLE_MAPS_API_KEY=AIzaSyDuVNR4zO8eFQHUqPadO69jUNUjzPgPWTU" `
  --project solutionchallenge-494200
cd ..

# ── 4. Update Firestore Security Rules ───────────────────────
# (paste rules from Phase 2-4 section above into Firebase Console → Rules)

# ── 5. Deploy frontend ────────────────────────────────────────
npx -y firebase-tools@latest deploy --only hosting --project solutionchallenge-494200

# ── 6. Verify all endpoints ──────────────────────────────────
# 1. Open your frontend: https://solutionchallenge-494200.web.app
# 2. Log in, open DevTools (F12) -> Console, and run: console.log(window.__fbToken)
# 3. Copy the token and paste it below

$BASE = "https://supply-chain-api-183345942117.asia-south1.run.app"
$TOKEN = "PASTE_YOUR_TOKEN_HERE"
$HEADERS = @{ Authorization = "Bearer $TOKEN" }

Invoke-RestMethod -Uri "$BASE/api/monitoring/health" -Headers $HEADERS      # → healthy
Invoke-RestMethod -Uri "$BASE/api/analytics/overview" -Headers $HEADERS     # → KPI data
Invoke-RestMethod -Uri "$BASE/api/streaming/active" -Headers $HEADERS       # → {count: 0}
Invoke-RestMethod -Uri "$BASE/api/decisions/impact-summary" -Headers $HEADERS  # → impact KPIs
Start-Process "$BASE/docs"                           # browse all 40+ endpoints
```

**Live app:** https://solutionchallenge-494200.web.app

---

## ✅ Complete Phases 2–5 Verification Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | `GET /api/monitoring/health` | `{"status": "healthy"}` |
| 2 | `GET /api/monitoring/metrics` | latency + traffic data |
| 3 | `GET /api/monitoring/sla` | on_time_pct + 30-day trend |
| 4 | `GET /api/analytics/overview` | KPI object |
| 5 | `GET /api/streaming/active` | `{"count": 0}` |
| 6 | `POST /api/digital-twin/simulate` | recommendation + charts data |
| 7 | `GET /api/decisions/pending` | `{"count": 0}` initially |
| 8 | `GET /api/reports/summary` | full org summary |
| 9 | Sidebar nav | Live Map · Decisions · Digital Twin · Monitoring · Reports |
| 10 | Dashboard | Stats update live (no F5) |
| 11 | Live Tracking | SVG map loads with city nodes |
| 12 | GPS Simulation | Start → marker moves on map in <20s |
| 13 | Analytics | All 4 chart tabs render |
| 14 | Messages | Sent message appears instantly (onSnapshot) |
| 15 | Decisions page | Generate cascade → 4-tier cards appear |
| 16 | Approve decision | Shipment risk score updates in Firestore |
| 17 | Digital Twin | Run 200 scenarios → PROCEED/CAUTION banner |
| 18 | Mode comparison | Bar chart shows best alternative |
| 19 | Monitoring page | Traffic + latency charts, SLA gauge |
| 20 | Reports page | SLA trend, decision breakdown, CSV download |
| 21 | `/api/reports/export/shipments.csv` | CSV file downloads |
| 22 | GitHub Actions | Push to main → auto-deploy triggers |
| 23 | Shipment detail GPS | Breadcrumb table appears when sim active |
| 24 | Disruption banner | Red banner in shipment detail on disruption event |


### What was added in Phase 2

| Component | Description |
|-----------|-------------|
| `backend/app/services/gps_simulator.py` | Simulates vehicle movement along routes, writes Firestore |
| `backend/app/routers/streaming.py` | `POST /api/streaming/start/{id}`, `stop/{id}`, `GET /active` |
| `backend/app/routers/analytics.py` | Overview KPIs, risk timeline, carrier performance, forecast |
| `backend/app/routers/messages.py` | + unread count, mark-as-read, thread grouping |
| `backend/app/routers/shipments.py` | + `/location`, `/gps-track`, `/events` endpoints |
| `frontend/src/pages/LiveTrackingPage.jsx` | SVG India map with real-time vehicle markers |
| `frontend/src/pages/AnalyticsPage.jsx` | Full Recharts: risk trend, delays, carriers, forecast |
| `frontend/src/pages/DashboardPage.jsx` | Firestore `onSnapshot` — zero-polling real-time stats |
| `frontend/src/pages/ShipmentDetailPage.jsx` | GPS breadcrumbs, disruption events, sim controls |
| `frontend/src/pages/MessagesPage.jsx` | Firestore `onSnapshot`, thread sidebar, unread badges |

### PHASE 2 STEP 1: Redeploy Backend

```bash
cd "c:\Gowtami\Solution Challenge\Prototype\backend"

# Build and push new image (v2)
gcloud builds submit \
  --tag asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:v2

# Deploy with updated image
gcloud run deploy supply-chain-api \
  --image asia-south1-docker.pkg.dev/solutionchallenge-494200/supply-chain-images/supply-chain-api:v2 \
  --platform managed \
  --region asia-south1 \
  --memory 512Mi \
  --allow-unauthenticated \
  --service-account=supply-chain-sa@solutionchallenge-494200.iam.gserviceaccount.com \
  --set-env-vars GCP_PROJECT_ID=solutionchallenge-494200,GCP_REGION=asia-south1,MODEL_SERVER_URL=https://model-server-183345942117.asia-south1.run.app,GOOGLE_MAPS_API_KEY=AIzaSyDuVNR4zO8eFQHUqPadO69jUNUjzPgPWTU
```

**Verify new endpoints:**
```bash
BASE=https://supply-chain-api-183345942117.asia-south1.run.app

# Analytics overview (no auth required for quick test)
curl $BASE/api/analytics/overview

# Check docs for all new routes
open $BASE/docs
```

### PHASE 2 STEP 2: Update Firestore Security Rules

Add rules for the new `gps_track` and `events` subcollections:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }

    match /organizations/{orgId} {
      allow read: if request.auth != null && request.auth.token.org_id == orgId;
      allow write: if false;

      match /{subcollection}/{docId} {
        allow read: if request.auth != null && request.auth.token.org_id == orgId;
        allow write: if false;
      }
    }

    match /shipments/{shipmentId} {
      allow read: if request.auth != null &&
        resource.data.org_id == request.auth.token.org_id;
      allow write: if false;

      // GPS track and events subcollections
      match /gps_track/{pointId} {
        allow read: if request.auth != null;
        allow write: if false;
      }
      match /events/{eventId} {
        allow read: if request.auth != null;
        allow write: if false;
      }
    }
  }
}
```

### PHASE 2 STEP 3: Rebuild and Redeploy Frontend

```bash
cd "c:\Gowtami\Solution Challenge\Prototype\frontend"

# Build (recharts already installed)
npm run build

# Deploy to Firebase Hosting
cd ..
firebase deploy --only hosting
```

**Your live app:** `https://solutionchallenge-494200.web.app`

### PHASE 2 STEP 4: Test Real-Time GPS Simulation

1. Login to the app → go to **Shipments**
2. Create a new shipment (Mumbai → Delhi, truck mode)
3. Open the shipment detail page → click **"Start Live GPS Simulation"**
4. Switch to **Live Map** → see the vehicle marker move in real-time
5. Watch the **Dashboard** stats update automatically (no refresh!)
6. Check **Messages** → send a message → it appears instantly

### ✅ Phase 2 Verification Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | `GET /api/streaming/active` | `{"active_simulations": [], "count": 0}` |
| 2 | `GET /api/analytics/overview` | JSON with KPI data |
| 3 | `GET /api/analytics/risk-timeline` | 30-day trend array |
| 4 | Live Tracking page loads | SVG map with city dots visible |
| 5 | Start simulation on a shipment | Marker moves on map within 15s |
| 6 | Dashboard stats update live | Stats reflect simulation progress |
| 7 | Messages page real-time | Sent message appears instantly |
| 8 | Analytics charts render | Recharts area/bar/line charts visible |
| 9 | ShipmentDetail GPS track | Table of lat/lng breadcrumbs appears |
| 10 | Disruption banner | Red banner appears when vehicle hits disruption event |
