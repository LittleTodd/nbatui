#!/bin/bash
# Start only the Python Data Service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/data-service"

# Activate venv if exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "🐍 Starting NBA Data Service on http://localhost:8765"
echo "📖 API Docs: http://localhost:8765/docs"
uvicorn main:app --reload --port 8765
