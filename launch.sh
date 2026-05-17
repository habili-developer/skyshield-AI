#!/bin/bash
# Quick launch script for SkyShield AI

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "============================================"
echo "  SkyShield AI - Launch Menu"
echo "============================================"
echo ""
echo "1) Start Backend API Server (Port 8000)"
echo "2) Start Dashboard (Port 8501)"
echo "3) Start Both (in separate terminals)"
echo "4) Run Tests"
echo "5) Check Installation"
echo ""

if [ -z "$1" ]; then
    read -p "Select option (1-5): " OPTION
else
    OPTION=$1
fi

# Activate virtual environment
if [ ! -d ".venv" ]; then
    echo "Error: Virtual environment not found. Run setup first."
    exit 1
fi

source .venv/bin/activate

case $OPTION in
    1)
        echo "Starting backend on http://localhost:8000"
        echo "API docs: http://localhost:8000/docs"
        echo "Press Ctrl+C to stop"
        echo ""
        uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
        ;;
    2)
        echo "Starting dashboard on http://localhost:8501"
        echo "Press Ctrl+C to stop"
        echo ""
        streamlit run frontend/dashboard.py
        ;;
    3)
        echo "Starting both backend and dashboard..."
        echo "Backend: http://localhost:8000/docs"
        echo "Dashboard: http://localhost:8501"
        echo ""
        echo "Open two terminals and run:"
        echo "  Terminal 1: bash launch.sh 1"
        echo "  Terminal 2: bash launch.sh 2"
        ;;
    4)
        echo "Running tests..."
        pytest tests/ -v
        ;;
    5)
        echo "Checking installation..."
        python -c "import fastapi; print(f'✓ FastAPI {fastapi.__version__}')"
        python -c "import uvicorn; print(f'✓ Uvicorn installed')"
        python -c "import pydantic; print(f'✓ Pydantic installed')"
        python -c "import requests; print(f'✓ Requests installed')"
        echo ""
        echo "Checking data files..."
        [ -f "data/sample_scenarios.json" ] && echo "✓ Sample scenarios found" || echo "✗ Sample scenarios missing"
        [ -f "data/rules/airspace_rules.md" ] && echo "✓ Rules found" || echo "✗ Rules missing"
        echo ""
        echo "Optional packages (for dashboard):"
        python -c "import pandas; print(f'✓ Pandas installed')" 2>/dev/null || echo "⚠ Pandas not installed"
        python -c "import streamlit; print(f'✓ Streamlit installed')" 2>/dev/null || echo "⚠ Streamlit not installed"
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac
