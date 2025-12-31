"""
NBA-TUI Data Service
FastAPI server providing NBA game data and social media heat metrics
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import games, social, polymarket

app = FastAPI(
    title="NBA-TUI Data Service",
    description="Provides NBA game data and social heat metrics for the TUI",
    version="0.1.0"
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    uvicorn.run(app, host="0.0.0.0", port=8765, log_level="warning", access_log=False)
