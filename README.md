# SkyShield AI

**An Intelligent Multi-Sensor Early Warning and Airspace Threat Detection System**

SkyShield AI is a defensive multi-sensor early-warning platform that fuses radar, RF, camera, thermal, acoustic, and optional ADS-B evidence into a unified threat picture. The system scores risk over time and uses an LLM copilot to explain alerts in plain language for operators and judges.

> **Defensive monitoring only** — no targeting, weapon control, or offensive planning.

## Architecture

```
Sensor Inputs → Preprocessing → Fusion Engine → Threat Engine → State Store
                                                                      ↓
                                                            Dashboard + LLM Copilot
```

Operational flow: **detect → preprocess → fuse → score → alert → explain**

| Layer | Responsibility |
|-------|----------------|
| Sensor inputs | Simulated radar, RF, camera, thermal, acoustic, ADS-B events |
| Preprocessing | Timestamp alignment, normalization, noise filter, feature extraction |
| Fusion engine | Multi-sensor track building, confidence scoring, conflict detection |
| Threat engine | Rule-based defensive scoring (GREEN / YELLOW / ORANGE / RED) |
| State store | Live tracks, alerts, history, timeline, operator logs |
| Dashboard | React operations UI with live map, panels, and WebSocket updates |
| LLM copilot | Grounded summaries and Q&A (explanation only — does not score threats) |

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Terminal 1 — API
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — React dashboard
cd frontend/sky-shield-ui && npm install && npm run dev

# Optional — Streamlit dashboard
streamlit run frontend/dashboard.py
```

- API docs: http://localhost:8000/docs  
- React UI: http://localhost:5173  
- Streamlit UI: http://localhost:8501  

## Demo scenarios

| Scenario | Behavior |
|----------|----------|
| `normal` | Authorized helicopter transit outside restricted zone |
| `suspicious` | Unknown UAS with irregular maneuvers near protected area |
| `restricted_intrusion` | Escalating approach and zone breach with RED alert |

```bash
curl -X POST "http://localhost:8000/simulation/reset?scenario=restricted_intrusion"
curl -X POST "http://localhost:8000/simulation/step"
curl -X POST "http://localhost:8000/assistant/ask" \
  -H "Content-Type: application/json" \
  -d '{"question":"Why is the latest contact risky?"}'
```

## LLM modes

| Mode | Use |
|------|-----|
| `mock` (default) | Offline, reliable for demos |
| `ollama` | Local provider via Ollama |

```bash
cp .env.example .env
# LLM_PROVIDER=mock
```

## Project structure

```text
backend/app/
  api/              REST + WebSocket routes
  preprocessing/    Sensor event pipeline
  fusion/           Multi-sensor track fusion
  threat/           Defensive threat scoring
  pipeline/         Orchestrator (detect→…→alert)
  services/         Simulation, LLM, persistence
  schemas/          Unified sensor event models
frontend/
  sky-shield-ui/    React operations dashboard
  dashboard.py      Streamlit alternative UI
data/
  sample_scenarios.json
  rules/airspace_rules.md
tests/
docker-compose.yml
```

## Docker

```bash
docker compose up --build
```

Safest demo stack: local FastAPI + React UI + `LLM_PROVIDER=mock`.

## Safety positioning

- Monitoring, anomaly detection, threat scoring, and operator awareness only
- LLM explains decisions; fusion and threat engines make scoring decisions
- No countermeasure, jamming, or strike language in core logic

## Limitations

- Scenario-driven simulated data (not live field sensors)
- Rule-based scoring (transparent for demos; not ML-calibrated)
- In-memory/SQLite state (not production PostgreSQL)
- No authentication or role-based access yet

## Future improvements

- Real sensor feeds (ADS-B, SDR, camera) in controlled lab setup
- Temporal anomaly models (e.g. Isolation Forest) with calibrated weights
- PostgreSQL persistence, auth, and audit trails
- Embedding-based rulebook retrieval for the copilot

## License

Academic / hackathon prototype — see submission materials for team and use-case context.
