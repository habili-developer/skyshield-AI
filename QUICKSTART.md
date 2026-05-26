# SkyShield AI - Quick Start Guide

## Environment Setup

A Python virtual environment (`.venv`) has been created in the project folder with the following packages installed:

### Backend Dependencies (Installed ✓)
- FastAPI 0.136.1
- Uvicorn[standard] 0.47.0  
- Pydantic 2.13.4
- HTTPx 0.28.1
- Python-dotenv 1.2.2
- Requests 2.34.2
- Pytest 9.0.3

### Frontend Dependencies (Installing)
- Pandas 2.2+
- Plotly 5.24+
- Streamlit 1.41+

## How to Run

### Option 1: Backend Only (FastAPI Server)
```bash
source .venv/bin/activate      # or .venv\Scripts\activate on Windows
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```
Then access: `http://localhost:8000/docs`

### Option 2: Dashboard Only (Streamlit UI)
```bash
source .venv/bin/activate
streamlit run frontend/dashboard.py
```
The dashboard will open at `http://localhost:8501`

### Option 3: Both Backend + Dashboard
Open two terminals:
```bash
# Terminal 1: Backend
source .venv/bin/activate
uvicorn backend.app.main:app --reload

# Terminal 2: Dashboard
source .venv/bin/activate
streamlit run frontend/dashboard.py
```

## API Endpoints

- `GET /health` - Health check
- `GET /simulation/scenarios` - List available scenarios
- `POST /simulation/reset?scenario=normal` - Reset simulator
- `POST /simulation/step` - Step simulator one tick
- `POST /simulation/run?steps=3` - Run simulator N steps
- `GET /state` - Get current system state
- `GET /alerts` - Get active alerts
- `POST /assistant/summary` - Generate LLM summary
- `POST /assistant/ask` - Ask copilot a question
- `GET /assistant/explain-latest-alert` - Explain latest alert

## LLM Configuration

Edit `.env` to switch between mock (default) or Ollama:

```bash
LLM_PROVIDER=mock          # offline mode (default)
# or
LLM_PROVIDER=ollama
LLM_MODEL=gemma3
LLM_BASE_URL=http://localhost:11434/api
```

## Project Structure

```
skyshield-ai-llm-prototype/
├── backend/app/
│   ├── main.py              # FastAPI app entry point
│   ├── api/routes.py        # All API endpoints
│   ├── services/            # Business logic
│   │   ├── simulator.py     # Multi-sensor simulator
│   │   ├── threat.py        # Threat scoring
│   │   ├── fusion.py        # Multi-sensor fusion
│   │   ├── llm_service.py   # LLM provider abstraction
│   │   └── store.py         # In-memory state store
│   └── config.py            # Configuration from env vars
├── frontend/dashboard.py    # Streamlit dashboard
├── data/
│   ├── sample_scenarios.json
│   └── rules/airspace_rules.md
└── tests/
    └── test_threat.py       # Unit tests
```

## Testing

Run unit tests:
```bash
source .venv/bin/activate
pytest tests/
```

## Troubleshooting

If dependencies fail to install, ensure you're using the virtual environment:
```bash
.venv/bin/pip list  # should show fastapi, uvicorn, pydantic, etc.
```

If the backend fails to start, verify the data files exist:
```bash
ls -la data/sample_scenarios.json
ls -la data/rules/airspace_rules.md
```

## Next Steps

1. Start the backend
2. Open the dashboard in a browser
3. Click "Reset Scenario" to initialize
4. Click "Step 1" to advance the simulation
5. Use "Generate Incident Summary" to test the LLM copilot
