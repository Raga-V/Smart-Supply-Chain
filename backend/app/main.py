"""
Supply Chain Intelligence Platform — FastAPI Backend
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, organizations, shipments, fleet, warehouses, risk, messages, streaming, analytics, decisions, digital_twin, monitoring, reports, shipment_requests


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


# ── Global error handler ─────────────────────────────────────
# Ensures unhandled exceptions (e.g. Firestore index errors)
# still return JSON with CORS headers intact.

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )

# ── Routers ──────────────────────────────────────────────────

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(organizations.router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(shipments.router, prefix="/api/shipments", tags=["Shipments"])
app.include_router(fleet.router, prefix="/api/fleet", tags=["Fleet"])
app.include_router(warehouses.router, prefix="/api/warehouses", tags=["Warehouses"])
app.include_router(risk.router, prefix="/api/risk", tags=["Risk Assessment"])
app.include_router(messages.router, prefix="/api/messages", tags=["Messages"])
app.include_router(streaming.router, prefix="/api/streaming", tags=["GPS Streaming"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(decisions.router, prefix="/api/decisions", tags=["Self-Healing Decisions"])
app.include_router(digital_twin.router, prefix="/api/digital-twin", tags=["Digital Twin"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["Monitoring"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(shipment_requests.router, prefix="/api/shipment-requests", tags=["Shipment Requests"])


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
