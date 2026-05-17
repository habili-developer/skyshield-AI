
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv()


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_list(value: str | None) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass
class Settings:
    app_name: str = os.getenv(
        "APP_NAME",
        "SkyShield AI — An Intelligent Multi-Sensor Early Warning System",
    )
    app_env: str = os.getenv("APP_ENV", "development")
    api_host: str = os.getenv("API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("API_PORT", "8000"))
    operational_mode: str = os.getenv("SKYSHIELD_MODE", "demo").strip().lower()
    region_config_path: Path = Path(os.getenv("REGION_CONFIG_PATH", "configs/regions/dodoma.json")).resolve()
    opensky_enabled: bool = _parse_bool(os.getenv("OPENSKY_ENABLED", "false"), False)
    opensky_poll_seconds: float = float(os.getenv("OPENSKY_POLL_SECONDS", "15"))
    weather_overlay_enabled: bool = _parse_bool(os.getenv("WEATHER_OVERLAY_ENABLED", "false"), False)
    weather_poll_seconds: float = float(os.getenv("WEATHER_POLL_SECONDS", "120"))

    data_path: Path = Path(os.getenv("DATA_PATH", "data/sample_scenarios.json")).resolve()
    rules_path: Path = Path(os.getenv("RULES_PATH", "data/rules/airspace_rules.md")).resolve()

    llm_provider: str = os.getenv("LLM_PROVIDER", "mock").strip().lower()
    llm_model: str = os.getenv("LLM_MODEL", "gemma3").strip()
    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://localhost:11434/api").strip()
    llm_timeout_seconds: int = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))

    database_path: Path = Path(os.getenv("DATABASE_PATH", "data/skyshield.db")).resolve()
    database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{Path(os.getenv('DATABASE_PATH', 'data/skyshield.db')).resolve()}",
    ).strip()

    dashboard_title: str = os.getenv("DASHBOARD_TITLE", "SkyShield AI Dashboard")
    enable_cors: bool = _parse_bool(os.getenv("ENABLE_CORS", "true"), True)
    cors_allow_origins: List[str] = None
    api_key: Optional[str] = os.getenv("API_KEY", None)

    def __post_init__(self) -> None:
        self.cors_allow_origins = _parse_list(os.getenv("CORS_ALLOW_ORIGINS", "*"))
        if not self.database_url:
            self.database_url = f"sqlite:///{self.database_path}"
        if self.llm_provider not in {"mock", "ollama"}:
            raise ValueError(f"Unsupported LLM_PROVIDER: {self.llm_provider}")
        if self.operational_mode not in {"demo", "operational"}:
            raise ValueError(f"Unsupported SKYSHIELD_MODE: {self.operational_mode}")
        if self.enable_cors and not self.cors_allow_origins:
            self.cors_allow_origins = ["*"]


settings = Settings()
