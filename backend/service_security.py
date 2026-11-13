"""Request authentication helpers for the legacy FastAPI intake service.

Everything here fails closed: a missing or short secret rejects the request
rather than allowing it. Secret comparisons use hmac.compare_digest.
"""

import hashlib
import hmac
import os

from fastapi import Header, HTTPException

MIN_SECRET_LENGTH = 32
SERVICE_TOKEN_ENV = "AI_SERVICE_TOKEN"


def secrets_match(provided: str | None, expected: str | None) -> bool:
    """Constant-time comparison that never matches an empty expected value."""
    if not expected or provided is None:
        return False
    return hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))


def require_service_token(
    x_service_token: str | None = Header(default=None, alias="X-Service-Token"),
) -> None:
    """FastAPI dependency for the /ai/* routes.

    The routes read and write applicant records and call an LLM, so they are
    service-to-service only. AI_SERVICE_TOKEN must be set to at least 32
    characters; otherwise every call is refused with 503.
    """
    expected = os.getenv(SERVICE_TOKEN_ENV, "").strip()
    if len(expected) < MIN_SECRET_LENGTH:
        raise HTTPException(status_code=503, detail="Service authentication is not configured.")
    if not secrets_match(x_service_token, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def valid_meta_signature(raw_body: bytes, signature_header: str | None, app_secret: str | None) -> bool:
    """Verifies Meta's X-Hub-Signature-256 header ("sha256=<hex>") over the raw body."""
    if not app_secret or not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature_header[len("sha256=") :], expected)
