#!/bin/bash

# ANSI Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏀 NBA-TUI Setup Script 🏀${NC}"

# 1. Python Backend Setup
echo -e "\n${YELLOW}Setting up Data Service (Python)...${NC}"
if ! command -v python3 &> /dev/null; then
    echo "Python 3 could not be found. Please install Python 3."
    exit 1
fi

cd data-service
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "Installing Python dependencies..."
pip install -r requirements.txt
cd ..

# 2. Frontend Setup (Bun)
echo -e "\n${YELLOW}Setting up Frontend (Bun)...${NC}"

if ! command -v bun &> /dev/null; then
    echo "Bun is not installed."
    read -p "Do you want to install Bun now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        curl -fsSL https://bun.sh/install | bash
        # Source bun config if added to rc, or try to use direct path
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"
    else
        echo "Please install Bun manually (https://bun.sh) and run this script again."
        exit 1
    fi
fi

echo "Installing Node dependencies..."
bun install

echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo -e "Run ${BLUE}./start.sh${NC} to launch the app."
