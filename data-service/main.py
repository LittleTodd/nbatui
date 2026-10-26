"""
NBA-TUI Data Service
FastAPI server providing NBA game data and social media heat metrics
"""
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import games, social, polymarket
from services import cache_service
from workers.social_worker import SocialPrefetchWorker

worker = SocialPrefetchWorker()


def _preload_schedules():
    from services.nba_service import NBAService
    nba_service = NBAService()
    result = nba_service.preload_future_schedules(days=14)
    print(f"[Startup] Schedule preload complete: {result}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize cache database tables once at startup (BUG-11)
    cache_service.init_db()

    # Start background worker and schedule preloading
    worker.start()
    thread = threading.Thread(target=_preload_schedules, daemon=True)
    thread.start()

    yield

    worker.stop()


app = FastAPI(
    title="NBA-TUI Data Service",
    description="Provides NBA game data and social heat metrics for the TUI",
    version="0.1.0",
    lifespan=lifespan
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8765", "http://127.0.0.1:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# Include routers
app.include_router(games.router)
app.include_router(social.router)
app.include_router(polymarket.router)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "nba-data-service"}


if __name__ == "__main__":
    import uvicorn
    # Disable access logs to prevent terminal flicker in TUI
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="warning", access_log=False)
