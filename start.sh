#!/bin/bash

# ANSI Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure Bun is in PATH
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo -e "${BLUE}🚀 Launching NBA-TUI...${NC}"

# 1. Start Backend in Background
echo "starting data-service..."
(cd data-service && source venv/bin/activate && python3 main.py >> backend.log 2>&1) &
BACKEND_PID=$!

# Clean up background python on normal exit (q) as well as Ctrl+C / SIGTERM
cleanup() {
    if [ -n "${BACKEND_PID:-}" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
        BACKEND_PID=""
    fi
}
trap cleanup SIGINT SIGTERM EXIT

# Wait for backend to be ready
sleep 2

# 2. Start Frontend
echo -e "${GREEN}Starting UI...${NC}"
echo "Press 'q' to quit the app."
bun start
