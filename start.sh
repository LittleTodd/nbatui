#!/bin/bash

# ANSI Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Kill child processes (background python) on exit
trap 'kill 0' SIGINT

echo -e "${BLUE}🚀 Launching NBA-TUI...${NC}"

# 1. Start Backend in Background
echo "starting data-service..."
(cd data-service && source venv/bin/activate && python3 main.py) &

# Wait for backend to be ready
# (Simple sleep for now, could be a health check loop)
sleep 2

# 2. Start Frontend
echo -e "${GREEN}Starting UI...${NC}"
echo "Press 'q' or 'Esc' to quit the app."
bun start
