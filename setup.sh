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

# Check if venv exists and is valid (works on this machine)
NEED_NEW_VENV=false
if [ ! -d "venv" ]; then
    NEED_NEW_VENV=true
elif ! ./venv/bin/python3 --version &> /dev/null; then
    echo -e "${YELLOW}Existing venv is broken (from different machine?), recreating...${NC}"
    rm -rf venv
    NEED_NEW_VENV=true
fi

if [ "$NEED_NEW_VENV" = true ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Installing Python dependencies..."
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
cd ..

# 2. Frontend Setup (Bun)
echo -e "\n${YELLOW}Setting up Frontend (Bun)...${NC}"

# Set up Bun paths (in case just installed or already installed)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun &> /dev/null; then
    echo "Bun is not installed."
    read -p "Do you want to install Bun now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        curl -fsSL https://bun.sh/install | bash
        # Reload PATH after installation
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
