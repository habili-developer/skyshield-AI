
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from backend.app.config import settings
from backend.app.dependencies import verify_api_key
from backend.app.geospatial import GeospatialEngine
from backend.app.models.schemas import (
    LLMResponse,
    OperatorQuestion,
    ResetResponse,
    RunResponse,
    StateResponse,
    StepResponse,
    SummaryRequest,
)
from backend.app.pipeline.orchestrator import run_pipeline_step
from backend.app.services.system_health import build_system_health


router = APIRouter(dependencies=[Depends(verify_api_key)])


def _services(request: Request):
    return request.app.state.services


@router.get("/", include_in_schema=False)
def root():
    return {
        "message": "SkyShield AI Backend is running.",
        "docs": "/docs",
        "health": "/health",
    }


@router.get("/favicon.ico", include_in_schema=False)
def favicon():
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        "<circle cx='50' cy='50' r='45' fill='#007ACC'/>"
        "</svg>"
    )
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/health")
def health(request: Request):
    services = _services(request)
    return {
        "status": "ok",
        "mode": services.get("mode", settings.operational_mode),
        "streaming": services["stream_hub"].health(),
        "ingestion": services["ingestion"].health(),
        "livefeeds": services["livefeeds"].health(),
    }


@router.get("/metrics")
def metrics(request: Request):
    services = _services(request)
    snapshot = services["store"].snapshot()
    db_metrics = services["repository"].metrics()
    return {
        "mode": services.get("mode", settings.operational_mode),
        "tick": snapshot.get("tick", 0),
        "active_tracks": len(snapshot.get("latest_tracks", [])),
        "active_alerts": len(snapshot.get("alerts", [])),
        "recent_sensor_events": len(snapshot.get("recent_sensor_events", [])),
        "websocket": services["stream_hub"].health(),
        "ingestion": services["ingestion"].health(),
        "livefeeds": services["livefeeds"].health(),
        "database": db_metrics,
    }


@router.get("/regions/current")
def current_region(request: Request):
    geo = _services(request)["geospatial"]
    return {
        "deployment_name": geo.region.deployment_name,
        "map_center": geo.region.map_center,
        "operational_radius_km": geo.region.operational_radius_km,
        "restricted_zones": geo.region.restricted_zones,
        "geofences": geo.region.geofences,
        "coordinate_metadata": geo.region.coordinate_metadata,
    }


@router.get("/regions")
def list_regions():
    region_dir = Path("configs/regions")
    return {
        "regions": [
            path.stem for path in sorted(region_dir.glob("*.json"))
        ]
    }


@router.post("/regions/switch")
async def switch_region(request: Request, region: str):
    region_path = Path("configs/regions") / f"{region}.json"
    if not region_path.exists():
        raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    services = _services(request)
    geo = GeospatialEngine.from_file(region_path)
    services["geospatial"] = geo
    services["library"].restricted_zone = geo.active_zone_for_legacy_pipeline()
    services["store"].state["restricted_zone"] = services["library"].restricted_zone
    await services["stream_hub"].publish(
        "region_changed",
        {
            "region": region,
            "deployment_name": geo.region.deployment_name,
            "restricted_zone": services["library"].restricted_zone,
        },
    )
    return current_region(request)


@router.get("/livefeeds")
def livefeeds(request: Request):
    return _services(request)["livefeeds"].health()


@router.post("/livefeeds/{feed_name}/enable")
async def enable_livefeed(request: Request, feed_name: str):
    manager = _services(request)["livefeeds"]
    if feed_name not in manager.adapters:
        raise HTTPException(status_code=404, detail=f"Unknown live feed '{feed_name}'")
    return await manager.enable(feed_name)


@router.post("/livefeeds/{feed_name}/disable")
async def disable_livefeed(request: Request, feed_name: str):
    manager = _services(request)["livefeeds"]
    if feed_name not in manager.adapters:
        raise HTTPException(status_code=404, detail=f"Unknown live feed '{feed_name}'")
    return await manager.disable(feed_name)


@router.get("/history/tracks")
def history_tracks(request: Request, target_id: str | None = None, limit: int = 100):
    return {"tracks": _services(request)["repository"].recent_tracks(target_id=target_id, limit=min(limit, 500))}


@router.get("/history/alerts")
def history_alerts(request: Request, level: str | None = None, limit: int = 100):
    return {"alerts": _services(request)["repository"].recent_alerts(level=level, limit=min(limit, 500))}


@router.get("/history/anomalies")
def history_anomalies(request: Request, target_id: str | None = None, limit: int = 100):
    return {"anomalies": _services(request)["repository"].recent_anomalies(target_id=target_id, limit=min(limit, 500))}


@router.get("/replay/session")
def replay_session(request: Request, target_id: str | None = None, limit: int = 250):
    return _services(request)["repository"].replay_session(target_id=target_id, limit=min(limit, 1000))


@router.get("/simulation/scenarios")
def list_scenarios(request: Request):
    services = _services(request)
    return {
        "available_scenarios": services["library"].list_scenarios(),
        "restricted_zone": services["library"].restricted_zone,
    }


@router.post("/simulation/reset", response_model=ResetResponse)
async def reset_simulation(request: Request, scenario: str = "normal"):
    services = _services(request)
    library = services["library"]
    if scenario not in library.list_scenarios():
        raise HTTPException(status_code=404, detail=f"Unknown scenario '{scenario}'")
    services["current_scenario"] = scenario
    services["next_tick"] = 1
    services["filters"] = {}
    services["temporal_state"] = {"targets": {}}
    
    # Use current library zone which might have been updated
    restricted_zone = library.restricted_zone
    services["store"].reset(scenario=scenario, restricted_zone=restricted_zone)
    
    # Broadcast reset event
    await services["ws_manager"].broadcast({
        "type": "simulation_reset",
        "scenario": scenario,
        "restricted_zone": restricted_zone,
        "message": f"Simulation reset to scenario '{scenario}'"
    })
    await services["stream_hub"].publish("operator_event", {
        "event": "simulation_reset",
        "scenario": scenario,
        "restricted_zone": restricted_zone,
    })
    
    return {
        "message": f"Simulation reset to scenario '{scenario}'",
        "scenario": scenario,
        "available_scenarios": library.list_scenarios(),
    }


@router.post("/simulation/update_zone")
async def update_zone(request: Request, lat: float, lon: float, radius_km: float, name: str = "Active Zone"):
    services = _services(request)
    library = services["library"]
    
    new_zone = {
        "center": {"lat": lat, "lon": lon},
        "radius_km": radius_km,
        "name": name
    }
    library.restricted_zone = new_zone
    
    # Also update the store's current zone
    services["store"].state["restricted_zone"] = new_zone
    
    return {"message": "Zone updated", "restricted_zone": new_zone}


@router.post("/simulation/step", response_model=StepResponse)
async def simulation_step(request: Request):
    services = _services(request)
    tick = services["next_tick"]
    scenario = services["current_scenario"]
    raw_events, ended, scenario_display = services["library"].step(scenario, tick)
    snapshot = services["store"].snapshot()
    result = run_pipeline_step(
        tick=tick,
        raw_sensor_events=raw_events,
        scenario_label=scenario_display,
        ended=ended,
        history=snapshot["history"],
        restricted_zone=services["library"].restricted_zone,
        filters=services["filters"],
        temporal_state=services.get("temporal_state", {"targets": {}}),
    )
    services["temporal_state"] = result.temporal_state
    health = build_system_health(services)

    services["store"].apply_step(
        tick=tick,
        sensor_events=result.sensor_events,
        fused_tracks=result.fused_tracks,
        alerts=result.alerts,
        ended=ended,
        timeline_entries=result.timeline_entries,
        scenario=scenario_display,
        temporal_state=result.temporal_state,
        sensor_feed=result.sensor_feed,
        system_health=health,
    )
    services["repository"].persist_step(
        tick=tick,
        sensor_events=result.sensor_events,
        tracks=result.fused_tracks,
        alerts=result.alerts,
    )
    enriched_tracks = result.fused_tracks
    alerts = result.alerts
    sensor_events = result.sensor_events
    
    if ended:
        # Simulation ended. Stop incrementing tick.
        # DO NOT auto-reset to Tick 1.
        services["next_tick"] = tick 
    else:
        services["next_tick"] = tick + 1
    
    step_data = {
        "tick": tick,
        "scenario": result.scenario,
        "ended": ended,
        "sensor_events": sensor_events,
        "fused_tracks": enriched_tracks,
        "alerts": alerts,
        "sensor_feed": result.sensor_feed[-20:],
        "system_health": health,
    }
    
    await services["stream_hub"].publish("simulation_step", step_data)
    await services["dispatcher"].publish("pipeline_step_completed", step_data)
    
    return step_data


@router.post("/simulation/run", response_model=RunResponse)
async def simulation_run(request: Request, steps: int = 3):
    services = _services(request)
    latest = None
    executed = 0
    ended = False
    for _ in range(max(1, steps)):
        latest = await simulation_step(request)
        executed += 1
        ended = latest["ended"]
        if ended:
            break
    snapshot = services["store"].snapshot()
    return {
        "tick": snapshot["tick"],
        "scenario": snapshot["scenario"],
        "ended": snapshot["ended"],
        "steps_executed": executed,
        "latest_alerts": snapshot["alerts"][-10:],
        "latest_tracks": snapshot["latest_tracks"],
    }


@router.get("/state", response_model=StateResponse)
def get_state(request: Request):
    services = _services(request)
    snapshot = services["store"].snapshot()
    snapshot["system_health"] = build_system_health(services)
    return snapshot


@router.get("/system/health")
def system_health(request: Request):
    return build_system_health(_services(request))


@router.get("/sensor-feed")
def sensor_feed(request: Request):
    snapshot = _services(request)["store"].snapshot()
    return {"feed": snapshot.get("sensor_feed", [])[-50:]}


@router.post("/simulation/judge-demo")
async def judge_demo(request: Request):
    """One-click scripted demo: restricted intrusion with full escalation."""
    services = _services(request)
    library = services["library"]
    services["current_scenario"] = "restricted_intrusion"
    services["next_tick"] = 1
    services["filters"] = {}
    services["temporal_state"] = {"targets": {}}
    services["store"].reset(
        scenario="restricted_intrusion",
        restricted_zone=library.restricted_zone,
    )
    steps_run = 0
    last = None
    for _ in range(5):
        last = await simulation_step(request)
        steps_run += 1
        if last.get("ended"):
            break
    return {
        "message": "Judge demo sequence completed",
        "steps_executed": steps_run,
        "final_tick": last["tick"] if last else 0,
        "latest_tracks": last["fused_tracks"] if last else [],
        "latest_alerts": last["alerts"] if last else [],
    }


@router.get("/alerts")
def get_alerts(request: Request):
    return {"alerts": _services(request)["store"].snapshot()["alerts"]}


@router.post("/assistant/summary", response_model=LLMResponse)
def assistant_summary(request: Request, payload: SummaryRequest | None = None):
    services = _services(request)
    snapshot = services["store"].snapshot()
    result = services["copilot"].summarize(snapshot, focus=payload.focus if payload else None)
    services["store"].state["latest_summary"] = result["answer"]
    return result


@router.post("/assistant/ask", response_model=LLMResponse)
def assistant_ask(request: Request, payload: OperatorQuestion):
    services = _services(request)
    snapshot = services["store"].snapshot()
    return services["copilot"].ask(payload.question, snapshot)


@router.get("/assistant/explain-latest-alert", response_model=LLMResponse)
def explain_latest_alert(request: Request):
    services = _services(request)
    snapshot = services["store"].snapshot()
    latest_alert = snapshot["alerts"][-1] if snapshot["alerts"] else None
    if latest_alert is None:
        raise HTTPException(status_code=404, detail="No alert available yet.")
    track = next((t for t in snapshot["latest_tracks"] if t["target_id"] == latest_alert["target_id"]), None)
    if track is None:
        raise HTTPException(status_code=404, detail="Track for latest alert not found.")
    return services["copilot"].explain_alert(latest_alert, track)
