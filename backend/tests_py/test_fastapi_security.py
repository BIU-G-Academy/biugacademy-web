"""Security regression tests for the legacy FastAPI intake service.

They use placeholder secrets and a temporary SQLite file. No network calls are
made: the outbound WhatsApp sender is replaced with a recorder.
"""

import hashlib
import hmac
import json
import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

APP_SECRET = "test-app-secret-not-a-real-value"
VERIFY_TOKEN = "test-verify-token-not-a-real-value"
SERVICE_TOKEN = "s" * 40


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db = tmp_path / "intake.db"
    env = {
        "WHATSAPP_ACCESS_TOKEN": "placeholder",
        "WHATSAPP_PHONE_NUMBER_ID": "placeholder",
        "WHATSAPP_VERIFY_TOKEN": VERIFY_TOKEN,
        "WHATSAPP_APP_SECRET": APP_SECRET,
        "OPENAI_API_KEY": "placeholder",
        "DATABASE_URL": f"sqlite:///{db}",
        "AI_SERVICE_TOKEN": SERVICE_TOKEN,
    }
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    for mod in [m for m in sys.modules if m in {
        "fastapi_intake", "sqlalchemy_models", "sqlite_store", "config_loader",
        "ai_intake_service", "whatsapp_service", "service_security",
    }]:
        del sys.modules[mod]

    import fastapi_intake
    from fastapi.testclient import TestClient

    sent = []
    monkeypatch.setattr(fastapi_intake, "send_whatsapp_text", lambda to, text: sent.append((to, text)))
    with TestClient(fastapi_intake.app) as c:
        c.sent = sent
        c.module = fastapi_intake
        yield c


def sign(body: bytes, secret: str = APP_SECRET) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


INTAKE = {"name": "Teste", "contact": "teste@example.com", "interest": "digital", "motivation": "learn"}


@pytest.mark.parametrize("path,body", [
    ("/ai/intake", INTAKE),
    ("/ai/coach", {"applicant_id": 1, "module_id": "m1"}),
    ("/ai/checkin", {"applicant_id": 1, "message": "done"}),
    ("/ai/nudge", {"status": "partial", "task": "t"}),
])
def test_ai_routes_reject_missing_or_wrong_token(client, path, body):
    assert client.post(path, json=body).status_code == 401
    assert client.post(path, json=body, headers={"X-Service-Token": "wrong"}).status_code == 401


def test_ai_route_accepts_valid_token(client):
    res = client.post("/ai/intake", json=INTAKE, headers={"X-Service-Token": SERVICE_TOKEN})
    assert res.status_code == 200, res.text


def test_ai_routes_fail_closed_when_token_unset_or_short(client, monkeypatch):
    for value in ["", "short"]:
        monkeypatch.setenv("AI_SERVICE_TOKEN", value)
        res = client.post("/ai/nudge", json={"status": "partial", "task": "t"}, headers={"X-Service-Token": value})
        assert res.status_code == 503


def inbound(phone="244923000111", text="feito"):
    return json.dumps({"entry": [{"changes": [{"value": {
        "contacts": [{"profile": {"name": "Forged"}, "wa_id": phone}],
        "messages": [{"from": phone, "id": "wamid.1", "type": "text", "text": {"body": text}}],
    }}]}]}).encode()


def applicant_count(client):
    from sqlalchemy import func, select
    with client.module.SessionLocal() as db:
        return db.execute(select(func.count()).select_from(client.module.Applicant)).scalar_one()


@pytest.mark.parametrize("headers", [
    {},
    {"X-Hub-Signature-256": "sha256=" + "0" * 64},
    {"X-Hub-Signature-256": "md5=abc"},
])
def test_webhook_rejects_unsigned_or_forged_deliveries(client, headers):
    body = inbound()
    res = client.post("/webhooks/whatsapp", content=body, headers={"Content-Type": "application/json", **headers})
    assert res.status_code == 401
    assert applicant_count(client) == 0
    assert client.sent == []


def test_webhook_rejects_signature_made_with_another_secret(client):
    body = inbound()
    res = client.post("/webhooks/whatsapp", content=body,
                      headers={"Content-Type": "application/json", "X-Hub-Signature-256": sign(body, "other-secret")})
    assert res.status_code == 401
    assert applicant_count(client) == 0


def test_webhook_accepts_valid_signature_without_inventing_opt_in(client):
    body = inbound()
    res = client.post("/webhooks/whatsapp", content=body,
                      headers={"Content-Type": "application/json", "X-Hub-Signature-256": sign(body)})
    assert res.status_code == 200
    from sqlalchemy import select
    with client.module.SessionLocal() as db:
        applicant = db.execute(select(client.module.Applicant)).scalar_one()
        assert applicant.whatsapp_opt_in is False


def test_webhook_verification_uses_the_configured_token(client):
    ok = client.get("/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "c"})
    bad = client.get("/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "c"})
    assert ok.status_code == 200 and ok.text == "c"
    assert bad.status_code == 403


def test_admin_broadcast_rejects_wrong_secret(client, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET", "a" * 40)
    res = client.post("/admin/cohort/broadcast-weekly-task", json={"track": "digital", "module_id": "m1"},
                      headers={"ADMIN_SECRET": "wrong"})
    assert res.status_code == 403
