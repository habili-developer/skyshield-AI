import os
import time
import random
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic_settings import BaseSettings
import httpx

from app.models import (
    WsFrameOut,
    TrackOut,
    AlertOut,
    StatsOut,
    HealthzOut,
    CopilotRequest,
)
from app.sim import SimulationEngine

class Settings(BaseSettings):
    lovable_api_key: str = ""
    model_config = {"env_file": ".env"}

settings = Settings()

app = FastAPI(title="skyshield-api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sim_engine = SimulationEngine()


@app.get("/healthz", response_model=HealthzOut)
async def healthz():
    return {"status": "ok"}


@app.post("/sim/step")
async def sim_step():
    sim_engine.step()
    return {"status": "ok"}


@app.post("/sim/reset")
async def sim_reset():
    sim_engine.reset()
    return {"status": "ok"}


@app.post("/alerts/{alert_id}/ack")
async def ack_alert(alert_id: str):
    if alert_id in sim_engine.alerts:
        sim_engine.alerts[alert_id].acknowledged = True
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Alert not found")


@app.get("/tracks", response_model=list[TrackOut])
async def get_tracks():
    tracks_out = []
    for track in sim_engine.tracks.values():
        forecast = track.kf.forecast(20, 0.25)
        tracks_out.append(
            TrackOut(
                id=track.id,
                callsign=track.callsign,
                type=track.type,
                lng=track.kf.x[0],
                lat=track.kf.x[1],
                vLng=track.kf.x[2],
                vLat=track.kf.x[3],
                speed_kts=track.speed_kts,
                altitude_m=track.altitude_m,
                bearing=track.bearing,
                rcs=track.rcs,
                level=track.level,
                history=track.history,
                forecast=[list(p) for p in forecast],
            )
        )
    return tracks_out


@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            start = time.time()
            sim_engine.step(250.0)

            tracks_out = []
            for track in sim_engine.tracks.values():
                forecast = track.kf.forecast(20, 0.25)
                tracks_out.append(
                    TrackOut(
                        id=track.id,
                        callsign=track.callsign,
                        type=track.type,
                        lng=track.kf.x[0],
                        lat=track.kf.x[1],
                        vLng=track.kf.x[2],
                        vLat=track.kf.x[3],
                        speed_kts=track.speed_kts,
                        altitude_m=track.altitude_m,
                        bearing=track.bearing,
                        rcs=track.rcs,
                        level=track.level,
                        history=track.history,
                        forecast=[list(p) for p in forecast],
                    )
                )

            alerts_out = []
            for alert in sim_engine.alerts.values():
                alerts_out.append(
                    AlertOut(
                        id=alert.id,
                        ts=alert.ts,
                        level=alert.level,
                        title=alert.title,
                        body=alert.body,
                        track_id=alert.track_id,
                        acknowledged=alert.acknowledged,
                    )
                )

            stats = StatsOut(
                cpu=random.uniform(15, 45),
                mem_gb=random.uniform(2.1, 3.8),
                latency_ms=(time.time() - start) * 1000,
                sensors="6/6 ONLINE",
            )

            frame = WsFrameOut(
                tick=sim_engine.tick,
                ts=datetime.now(timezone.utc).isoformat(),
                tracks=tracks_out,
                alerts=alerts_out,
                stats=stats,
            )

            await websocket.send_json(frame.model_dump())
            await asyncio.sleep(0.25)
    except WebSocketDisconnect:
        pass


@app.post("/copilot")
async def copilot(request: CopilotRequest):
    system_prompt = """You are a Defensive AI Copilot for the SkyShield airspace defense system.
Rules of Engagement (ROE):
- Tiered response: monitor → RF disrupt → intercept
- No engagement without escalation
- Prefer non-kinetic (RF disrupt) when time-to-live (TTL) > 60 seconds
- Be concise and tactical
- Focus on the current airspace situation in Dodoma (35.7384, -6.1748)"""

    if not settings.lovable_api_key:
        async def fake_stream():
            yield "data: " + "No API key configured. This is a simulated response.\n\n"
        return StreamingResponse(fake_stream(), media_type="text/event-stream")

    async def stream_response():
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                "https://gateway.lovable.dev/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.lovable_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gemini-2.0-flash",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.query},
                    ],
                    "stream": True,
                },
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        yield line + "\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")


import asyncio

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
