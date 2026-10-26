#!/bin/bash
# NBA-TUI Development Mode
# Starts both the Python data service and the TUI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🏀 Starting NBA-TUI Development Environment..."

# Check if Python venv exists
if [ ! -d "$PROJECT_ROOT/data-service/venv" ]; then
    echo "📦 Creating Python virtual environment..."
    cd "$PROJECT_ROOT/data-service"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source "$PROJECT_ROOT/data-service/venv/bin/activate"
fi

# Start Python data service in background
echo "🐍 Starting Data Service on port 8765..."
cd "$PROJECT_ROOT/data-service"
uvicorn main:app --reload --port 8765 >> backend.log 2>&1 &
DATA_SERVICE_PID=$!

# Wait for service to be ready
echo "⏳ Waiting for Data Service..."
sleep 3

# Check if service is running
if curl -s http://localhost:8765/health > /dev/null; then
    echo "✅ Data Service is ready!"
else
    echo "❌ Data Service failed to start"
    kill $DATA_SERVICE_PID 2>/dev/null
    exit 1
fi

# Start TUI
echo "🖥️  Starting TUI..."
cd "$PROJECT_ROOT"
bun run start

# Cleanup on exit
trap "kill $DATA_SERVICE_PID 2>/dev/null" EXIT
