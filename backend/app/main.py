"""
Supply Chain Intelligence Platform — FastAPI Backend
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, organizations, shipments, fleet, warehouses, risk, messages


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — initialize Firebase Admin SDK.

    Uses Application Default Credentials (ADC):
    - Local dev: `gcloud auth application-default login`
    - Cloud Run: attached service account
    """
    import firebase_admin

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    yield


app = FastAPI(
    title="Supply Chain Intelligence API",
    description="Real-time supply chain risk prediction and autonomous mitigation",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(organizations.router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(shipments.router, prefix="/api/shipments", tags=["Shipments"])
app.include_router(fleet.router, prefix="/api/fleet", tags=["Fleet"])
app.include_router(warehouses.router, prefix="/api/warehouses", tags=["Warehouses"])
app.include_router(risk.router, prefix="/api/risk", tags=["Risk Assessment"])
app.include_router(messages.router, prefix="/api/messages", tags=["Messages"])


@app.get("/", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "Supply Chain Intelligence API",
        "version": "1.0.0",
    }


@app.get("/api/health", tags=["Health"])
async def api_health():
    return {"status": "ok", "region": settings.GCP_REGION}
