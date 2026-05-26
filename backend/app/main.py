
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from logging.config import dictConfig

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import router
from backend.app.config import settings
from backend.app.database.repository import OperationalRepository
from backend.app.events import EventDispatcher
from backend.app.geospatial import GeospatialEngine
from backend.app.ingestion import IngestionManager
from backend.app.livefeeds import LiveFeedManager
from backend.app.livefeeds.opensky import OpenSkyLiveFeed
from backend.app.livefeeds.weather import WeatherOverlayFeed
from backend.app.logging_config import LOGGING_CONFIG
from backend.app.services.llm_service import DefensiveCopilot
from backend.app.services.persistent_store import SqliteStore
from backend.app.services.retrieval import RulebookRetriever
from backend.app.services.simulator import ScenarioLibrary
from backend.app.services.websocket_manager import ConnectionManager
from backend.app.streaming import StreamHub


dictConfig(LOGGING_CONFIG)
logger = logging.getLogger("skyshield")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "SkyShield backend starting",
        extra={"env": settings.app_env, "llm_provider": settings.llm_provider},
    )
    services = app.state.services
    await services["stream_hub"].start()
    await services["ingestion"].start()
    await services["livefeeds"].start()
    yield
    await app.state.services["livefeeds"].stop()
    await app.state.services["ingestion"].stop()
    await app.state.services["stream_hub"].stop()
    logger.info("SkyShield backend shutting down")


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
    if settings.enable_cors:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_allow_origins,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    retriever = RulebookRetriever(str(settings.rules_path))
    ws_manager = ConnectionManager()
    stream_hub = StreamHub(ws_manager=ws_manager)
    ingestion = IngestionManager(stream_hub=stream_hub)
    dispatcher = EventDispatcher()
    region_engine = GeospatialEngine.from_file(settings.region_config_path)
    livefeeds = LiveFeedManager(stream_hub=stream_hub)
    livefeeds.register(
        OpenSkyLiveFeed(
            geospatial=region_engine,
            enabled=settings.opensky_enabled,
            poll_seconds=settings.opensky_poll_seconds,
        )
    )
    livefeeds.register(
        WeatherOverlayFeed(
            geospatial=region_engine,
            enabled=settings.weather_overlay_enabled,
            poll_seconds=settings.weather_poll_seconds,
        )
    )
    repository = OperationalRepository()
    library = ScenarioLibrary(str(settings.data_path))
    if settings.operational_mode == "operational":
        library.restricted_zone = region_engine.active_zone_for_legacy_pipeline()

    services = {
        "library": library,
        "store": SqliteStore(settings.database_path),
        "copilot": DefensiveCopilot(retriever=retriever),
        "ws_manager": ws_manager,
        "stream_hub": stream_hub,
        "ingestion": ingestion,
        "livefeeds": livefeeds,
        "dispatcher": dispatcher,
        "geospatial": region_engine,
        "repository": repository,
        "filters": {},
        "temporal_state": {"targets": {}},
        "current_scenario": "normal",
        "next_tick": 1,
        "mode": settings.operational_mode,
    }

    async def persist_livefeed_event(event):
        if event.get("type") not in {"livefeed_event", "region_changed"}:
            return
        payload = event.get("data", {})
        services["store"].append_live_event(payload)
        services["repository"].log(
            event_type="livefeed_event",
            message=payload.get("message", "Live feed event received"),
            tick=services["store"].snapshot().get("tick", 0),
            payload=payload,
        )

    stream_hub.subscribe(persist_livefeed_event)

    services["store"].reset(
        scenario=services["current_scenario"],
        restricted_zone=services["library"].restricted_zone,
    )

    app.state.services = services
    app.state.settings = settings
    app.include_router(router)

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        ws_manager: ConnectionManager = app.state.services["ws_manager"]
        await ws_manager.connect(websocket)
        logger.info("WebSocket connection established and managed")
        try:
            while True:
                # We mainly use WS for server -> client broadcasting,
                # but we need to keep the connection open and handle potential client pings
                data = await websocket.receive_text()
                logger.info(f"Received data from client: {data}")
                # If client sends something, we can echo it or handle it
                await ws_manager.send_personal_message({"message": f"Received: {data}"}, websocket)
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected by client")
            ws_manager.disconnect(websocket)
        except Exception as e:
            logger.error(f"WebSocket error in loop: {e}", exc_info=True)
            ws_manager.disconnect(websocket)

    return app


app = create_app()
