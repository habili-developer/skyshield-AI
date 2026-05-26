
from __future__ import annotations

import os
from typing import Any, Dict, List

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st


API_BASE = os.getenv("SKYSHIELD_API_BASE", "http://localhost:8000")
API_KEY = os.getenv("SKYSHIELD_API_KEY", "")

st.set_page_config(
    page_title="SkyShield AI — Operations Center",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)


def api_headers() -> Dict[str, str]:
    headers: Dict[str, str] = {}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    return headers


def api_get(path: str) -> Dict[str, Any]:
    response = requests.get(f"{API_BASE}{path}", headers=api_headers(), timeout=30)
    response.raise_for_status()
    return response.json()


def api_post(path: str, json_payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    response = requests.post(
        f"{API_BASE}{path}", json=json_payload, headers=api_headers(), timeout=60
    )
    response.raise_for_status()
    return response.json()


def build_map(latest_tracks: List[Dict[str, Any]], zone: Dict[str, Any], history: Dict[str, Any]) -> go.Figure:
    fig = go.Figure()
    zone_center = zone["center"]
    fig.add_trace(
        go.Scatter(
            x=[zone_center["lon"]],
            y=[zone_center["lat"]],
            mode="markers",
            name="Restricted Zone",
            marker=dict(size=14, symbol="x", color="#f43f5e"),
        )
    )
    for track in latest_tracks:
        pos = track["position"]
        level = track.get("threat_level", "green")
        color = {"red": "#ef4444", "orange": "#f97316", "yellow": "#f59e0b"}.get(level, "#10b981")
        fig.add_trace(
            go.Scatter(
                x=[pos["lon"]],
                y=[pos["lat"]],
                mode="markers+text",
                name=f"{track['target_id']} ({level})",
                text=[track["target_id"]],
                marker=dict(size=14, color=color),
            )
        )
        hist = history.get(track["target_id"], [])
        if hist:
            fig.add_trace(
                go.Scatter(
                    x=[item["lon"] for item in hist],
                    y=[item["lat"] for item in hist],
                    mode="lines",
                    line=dict(color=color, width=2, dash="dot"),
                    showlegend=False,
                )
            )
    fig.update_layout(
        title="Live Airspace Overview",
        template="plotly_dark",
        height=480,
        margin=dict(l=10, r=10, t=40, b=10),
    )
    return fig


st.markdown(
    """
    <style>
    .stApp { background-color: #0a0a0c; }
    .block-container { padding-top: 1.5rem; }
    </style>
    """,
    unsafe_allow_html=True,
)
st.title("SkyShield AI")
st.caption("An Intelligent Multi-Sensor Early Warning and Airspace Threat Detection System")

scenarios_payload = api_get("/simulation/scenarios")
scenario_names = scenarios_payload["available_scenarios"]

with st.sidebar:
    st.header("Simulation")
    scenario = st.selectbox("Scenario", scenario_names, index=0)
    if st.button("Reset", use_container_width=True):
        api_post(f"/simulation/reset?scenario={scenario}")
        st.rerun()
    if st.button("Step", use_container_width=True):
        api_post("/simulation/step")
        st.rerun()
    if st.button("Judge Demo", use_container_width=True, type="primary"):
        api_post("/simulation/judge-demo")
        st.rerun()
    st.markdown("---")
    st.subheader("LLM Copilot")
    question = st.text_area("Operator question", value="Why is the latest contact risky?")
    if st.button("Ask", use_container_width=True):
        answer = api_post("/assistant/ask", {"question": question})
        st.session_state["copilot_answer"] = answer["answer"]
    if st.button("Explain latest alert", use_container_width=True):
        explanation = api_get("/assistant/explain-latest-alert")
        st.session_state["latest_explanation"] = explanation["answer"]

state = api_get("/state")
health = api_get("/system/health")
latest_tracks = state.get("latest_tracks", [])
alerts = state.get("alerts", [])
top = latest_tracks[0] if latest_tracks else None

c1, c2, c3, c4 = st.columns(4)
c1.metric("Tick", state.get("tick", 0))
c2.metric("Scenario", state.get("scenario", "—"))
c3.metric("Tracks", len(latest_tracks))
c4.metric("Alerts", len(alerts))

col_l, col_r = st.columns([1.55, 1])

with col_l:
    st.plotly_chart(build_map(latest_tracks, state["restricted_zone"], state.get("history", {})), use_container_width=True)
    if latest_tracks:
        st.dataframe(
            pd.DataFrame(
                [
                    {
                        "target": t["target_id"],
                        "level": t["threat_level"],
                        "score": t["threat_score"],
                        "fusion": t.get("fusion_confidence"),
                        "anomaly": (t.get("anomaly") or {}).get("anomaly_label"),
                    }
                    for t in latest_tracks
                ]
            ),
            use_container_width=True,
        )

with col_r:
    st.subheader("System Health")
    for row in health.get("sensors", []) + health.get("components", []):
        st.markdown(f"**{row['name']}** — `{row['status']}`")
    st.subheader("Threat Panel")
    if top:
        st.error(f"{top.get('title')} ({top.get('threat_level', '').upper()})")
        st.write(top.get("explanation"))
    st.subheader("Explainability Trace")
    if top and top.get("explanation_trace"):
        for line in top["explanation_trace"]:
            st.markdown(f"- {line}")
    st.subheader("Live Sensor Feed")
    feed = state.get("sensor_feed", [])[-15:]
    for item in reversed(feed):
        st.caption(f"T-{item.get('tick')} | {item.get('type')} | {item.get('message')}")
    st.subheader("Event Timeline")
    for ev in reversed(state.get("event_timeline", [])[-12:]):
        st.caption(f"T-{ev.get('tick')} {ev.get('event')} {ev.get('target_id', '')}")
    st.subheader("Copilot")
    st.write(st.session_state.get("copilot_answer", st.session_state.get("latest_explanation", "Ask a question from the sidebar.")))
