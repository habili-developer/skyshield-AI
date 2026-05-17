# SkyShield AI — Screenshot Assets

Capture these views from the React dashboard (`http://localhost:5173`) for README and judging.

| File | How to capture |
|------|----------------|
| `01-normal-monitoring.png` | Scenario: **normal** → reset → 2–3 steps |
| `02-suspicious-escalation.png` | Scenario: **suspicious** → step until YELLOW/ORANGE |
| `03-orange-threat.png` | **suspicious** or **restricted_intrusion** at ORANGE |
| `04-red-intrusion.png` | **Judge Demo** button or restricted_intrusion at RED |
| `05-llm-explanation.png` | Copilot panel after asking “Why is the latest contact risky?” |
| `06-system-health.png` | Left column System Health panel |
| `07-anomaly-trace.png` | Explainability Trace with anomaly + persistence visible |

## Quick capture

1. Start backend: `uvicorn backend.app.main:app --reload`
2. Start UI: `cd frontend/sky-shield-ui && npm run dev`
3. Use **Judge Demo** for the full escalation sequence in one click.
