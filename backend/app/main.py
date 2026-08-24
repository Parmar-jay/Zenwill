"""
ZenWill Backend — FastAPI Application Entry Point
Mental Operating System API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import init_db
from app.routers import auth, profile, mind_profile, checkin, journal, missions, coach, emergency, analytics, events, community, purpose


import asyncio
from app.services.account_purger import start_expired_accounts_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    print("[ZenWill] API starting up...")
    await init_db()
    print("[ZenWill] Database tables verified/created")

    # Start background task to purge accounts that passed 7-day grace period
    worker_task = asyncio.create_task(start_expired_accounts_worker())

    yield
    print("[ZenWill] API shutting down")
    worker_task.cancel()


app = FastAPI(
    title="ZenWill API",
    description="Mental Operating System — Backend API for ZenWill",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(mind_profile.router, prefix="/api/v1")
app.include_router(checkin.router, prefix="/api/v1")
app.include_router(journal.router, prefix="/api/v1")
app.include_router(missions.router, prefix="/api/v1")
app.include_router(coach.router, prefix="/api/v1")
app.include_router(emergency.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(community.router, prefix="/api/v1")
app.include_router(purpose.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "app": "ZenWill API",
        "version": "1.0.0",
        "status": "healthy",
        "message": "Mental Operating System — API is running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "env": settings.APP_ENV}
