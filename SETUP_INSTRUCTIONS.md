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
