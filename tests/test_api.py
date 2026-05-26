import os

from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.config import settings


def test_root_endpoint_returns_status_links():
    original_api_key = settings.api_key
    settings.api_key = None
    app = create_app()
    client = TestClient(app)

    response = client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "SkyShield AI Backend is running."
    assert payload["docs"] == "/docs"
    assert payload["health"] == "/health"

    settings.api_key = original_api_key


def test_health_endpoint_returns_ok():
    original_api_key = settings.api_key
    settings.api_key = None
    app = create_app()
    client = TestClient(app)

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    settings.api_key = original_api_key
