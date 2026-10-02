"""Verify the public boundary used by the deployed frontend."""
import httpx
import pytest
from fastapi.testclient import TestClient

from backend.gateway import main as gateway
from backend.common.config import settings


@pytest.fixture
def gateway_client(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    gateway.windows.clear()
    with TestClient(gateway.app) as client:
        yield client
    gateway.windows.clear()


def test_proxy_preserves_request_and_supplies_its_own_secret(gateway_client, monkeypatch):
    requests = []

    class Upstream:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def request(self, method, url, **kwargs):
            requests.append((method, url, kwargs))
            return httpx.Response(201, json={"created": True})

    monkeypatch.setattr(gateway.httpx, "AsyncClient", Upstream)
    response = gateway_client.post("/events?q=campus", content=b'{"title":"Demo"}', headers={
        "Authorization": "Bearer test-token", "Content-Type": "application/json",
        "X-Gateway-Secret": "caller-supplied", "X-Internal-Secret": "caller-internal",
    })
    assert response.status_code == 201
    method, url, forwarded = requests[0]
    assert method == "POST"
    assert url == settings.event_service_url.rstrip("/") + "/events"
    assert forwarded["params"]["q"] == "campus"
    assert forwarded["content"] == b'{"title":"Demo"}'
    assert forwarded["headers"]["authorization"] == "Bearer test-token"
    assert forwarded["headers"]["X-Gateway-Secret"] == settings.internal_secret
    assert "X-Internal-Secret" not in forwarded["headers"]
    assert response.headers["cache-control"] == "no-store"


def test_internal_routes_and_large_bodies_are_blocked(gateway_client):
    assert gateway_client.get("/internal/users/example").status_code == 404
    assert gateway_client.post("/tickets/book", content=b"x" * 1_000_001).status_code == 413


def test_login_limit_cannot_be_bypassed_with_invented_tokens(gateway_client, monkeypatch):
    class Unavailable:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            raise httpx.ConnectError("unavailable")

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(gateway.httpx, "AsyncClient", Unavailable)
    for attempt in range(30):
        response = gateway_client.post("/auth/google", json={"credential": "invalid"}, headers={"Authorization": f"Bearer invented-{attempt}"})
        assert response.status_code == 503
    response = gateway_client.post("/auth/google", headers={"Authorization": "Bearer another"})
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"
