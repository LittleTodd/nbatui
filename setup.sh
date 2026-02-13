#!/usr/bin/env bash

set -euo pipefail

# ANSI colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

FORCE_INSTALL=false
AUTO_INSTALL_BUN=false

for arg in "$@"; do
    case "$arg" in
        --force) FORCE_INSTALL=true ;;
        --auto-install-bun) AUTO_INSTALL_BUN=true ;;
        -h|--help)
            cat <<'EOF'
Usage: ./setup.sh [options]

Options:
  --force              Reinstall Python and Bun dependencies even if unchanged.
  --auto-install-bun   Install Bun automatically if missing (non-interactive).
  -h, --help           Show this help message.
EOF
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            exit 1
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data-service"
STAMP_DIR="$SCRIPT_DIR/.agent"
PY_STAMP_FILE="$STAMP_DIR/setup-python.hash"
JS_STAMP_FILE="$STAMP_DIR/setup-bun.hash"

hash_file() {
    local file="$1"
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | awk '{print $1}'
    else
        sha256sum "$file" | awk '{print $1}'
    fi
}

echo -e "${BLUE}🏀 NBA-TUI Setup Script 🏀${NC}"
mkdir -p "$STAMP_DIR"

# 1) Python backend setup
echo -e "\n${YELLOW}Setting up Data Service (Python)...${NC}"
if ! command -v python3 >/dev/null 2>&1; then
    echo -e "${RED}Python 3 could not be found. Please install Python 3.9+ first.${NC}"
    exit 1
fi

cd "$DATA_DIR"

NEED_NEW_VENV=false
if [ ! -d "venv" ]; then
    NEED_NEW_VENV=true
elif ! ./venv/bin/python3 --version >/dev/null 2>&1; then
    echo -e "${YELLOW}Existing venv is invalid, recreating...${NC}"
    rm -rf venv
    NEED_NEW_VENV=true
fi

if [ "$NEED_NEW_VENV" = true ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

REQ_HASH="$(hash_file requirements.txt)"
PREV_REQ_HASH=""
if [ -f "$PY_STAMP_FILE" ]; then
    PREV_REQ_HASH="$(cat "$PY_STAMP_FILE")"
fi

if [ "$FORCE_INSTALL" = true ] || [ "$REQ_HASH" != "$PREV_REQ_HASH" ] || [ "$NEED_NEW_VENV" = true ]; then
    echo "Installing Python dependencies..."
    ./venv/bin/pip install --disable-pip-version-check --upgrade pip
    ./venv/bin/pip install --disable-pip-version-check -r requirements.txt
    echo "$REQ_HASH" > "$PY_STAMP_FILE"
else
    echo "Python dependencies unchanged, skipping install."
fi

cd "$SCRIPT_DIR"

# 2) Frontend setup (Bun)
echo -e "\n${YELLOW}Setting up Frontend (Bun)...${NC}"
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
    if [ "$AUTO_INSTALL_BUN" = true ]; then
        echo "Bun is not installed. Installing automatically..."
        curl -fsSL https://bun.sh/install | bash
        export PATH="$BUN_INSTALL/bin:$PATH"
    else
        if [ -t 0 ]; then
            read -r -p "Bun is not installed. Install now? (y/n) " reply
            if [[ "$reply" =~ ^[Yy]$ ]]; then
                curl -fsSL https://bun.sh/install | bash
                export PATH="$BUN_INSTALL/bin:$PATH"
            else
                echo -e "${RED}Please install Bun manually: https://bun.sh${NC}"
                exit 1
            fi
        else
            echo -e "${RED}Bun is required but missing. Re-run with --auto-install-bun or install from https://bun.sh${NC}"
            exit 1
        fi
    fi
fi

LOCK_FILE="$SCRIPT_DIR/bun.lock"
LOCK_HASH="$(hash_file "$LOCK_FILE")"
PREV_LOCK_HASH=""
if [ -f "$JS_STAMP_FILE" ]; then
    PREV_LOCK_HASH="$(cat "$JS_STAMP_FILE")"
fi

if [ "$FORCE_INSTALL" = true ] || [ "$LOCK_HASH" != "$PREV_LOCK_HASH" ] || [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    bun install --frozen-lockfile
    echo "$LOCK_HASH" > "$JS_STAMP_FILE"
else
    echo "Frontend dependencies unchanged, skipping install."
fi

echo -e "\n${GREEN}✅ Setup complete.${NC}"
echo -e "Run ${BLUE}./nbatui${NC} (or ${BLUE}./start.sh${NC}) to launch."
