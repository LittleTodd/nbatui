"""
NBA-TUI Data Service
FastAPI server providing NBA game data and social media heat metrics
"""
import os
import sys
import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def _setup_logging():
    """
    Redirect all backend logs, prints, and uvicorn output to backend.log
    unless NBA_DEBUG_CONSOLE=1 is explicitly set. This prevents background
    logging threads from outputting to stdout/stderr and causing TUI jitter.
    """
    if os.environ.get("NBA_DEBUG_CONSOLE") == "1":
        return

    log_dir = Path(__file__).resolve().parent
    log_file_path = log_dir / "backend.log"

    try:
        # Rotate if log exceeds 10MB to keep disk usage bounded
        if log_file_path.exists() and log_file_path.stat().st_size > 10 * 1024 * 1024:
            rotated = log_dir / "backend.log.1"
            if rotated.exists():
                rotated.unlink()
            log_file_path.rename(rotated)

        log_file = open(log_file_path, "a", buffering=1, encoding="utf-8")

        # Redirect Python-level stdout and stderr
        sys.stdout = log_file
        sys.stderr = log_file

        # Redirect OS-level file descriptors (1=stdout, 2=stderr)
        try:
            os.dup2(log_file.fileno(), 1)
            os.dup2(log_file.fileno(), 2)
        except Exception:
            pass

        # Configure root logger to output into backend.log
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            handlers=[logging.StreamHandler(log_file)],
            force=True
        )
    except Exception:
        pass


_setup_logging()

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
