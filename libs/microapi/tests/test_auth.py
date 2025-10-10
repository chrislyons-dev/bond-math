"""Tests for JWT authentication with dual-secret verification."""

import base64
import hashlib
import hmac
import json
import time
from typing import Any

import pytest

from microapi import Request
from microapi.auth import InternalJWT, JWTMiddleware
from microapi.errors import ForbiddenError, UnauthorizedError
from microapi.response import JsonResponse


class MockRequest:
    """Mock Cloudflare Workers request for testing."""

    def __init__(self, headers: dict[str, str] | None = None):
        self.headers_dict = headers or {}
        self._jwt_payload: Any = None

    def header(self, name: str) -> str | None:
        """Get header value (case-insensitive)."""
        for key, value in self.headers_dict.items():
            if key.lower() == name.lower():
                return value
        return None


def create_jwt_token(
    secret: str,
    audience: str = "svc-test",
    actor_sub: str = "user123",
    actor_perms: list[str] | None = None,
    exp_delta: int = 90,
) -> str:
    """Create a valid JWT token for testing.

    Args:
        secret: HMAC signing secret
        audience: Target audience (service identifier)
        actor_sub: Actor subject (user ID)
        actor_perms: Actor permissions
        exp_delta: Expiration time delta in seconds (default 90)

    Returns:
        Signed JWT token string
    """
    now = int(time.time())

    header = {
        "alg": "HS256",
        "typ": "JWT",
    }

    payload: dict[str, Any] = {
        "iss": "https://gateway.bond-math",
        "sub": "svc-gateway",
        "aud": audience,
        "exp": now + exp_delta,
        "rid": "test-request-id",
        "act": {
            "iss": "https://tenant.auth0.com/",
            "sub": actor_sub,
            "perms": actor_perms or [],
        },
    }

    # Encode header and payload
    header_b64 = base64url_encode(json.dumps(header))
    payload_b64 = base64url_encode(json.dumps(payload))

    # Sign with HMAC-SHA256
    data = f"{header_b64}.{payload_b64}"
    signature = hmac.new(
        secret.encode("utf-8"),
        data.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    signature_b64 = base64url_encode(signature)

    return f"{data}.{signature_b64}"


def base64url_encode(data: str | bytes) -> str:
    """Base64url encode data.

    Args:
        data: String or bytes to encode

    Returns:
        Base64url encoded string
    """
    if isinstance(data, str):
        data = data.encode("utf-8")

    encoded = base64.urlsafe_b64encode(data).decode("utf-8")
    return encoded.rstrip("=")


@pytest.mark.asyncio
async def test_jwt_middleware_valid_token():
    """Test JWT middleware with valid token."""
    secret = "test-secret-minimum-32-characters-long-for-security"
    middleware = JWTMiddleware(secret, "svc-test")

    token = create_jwt_token(secret, audience="svc-test")
    request = MockRequest(headers={"Authorization": f"Bearer {token}"})

    called = False

    async def next_handler(req: Request) -> JsonResponse:
        nonlocal called
        called = True
        # Verify JWT payload was attached
        assert hasattr(req, "_jwt_payload")
        payload: InternalJWT = req._jwt_payload  # type: ignore
        assert payload.aud == "svc-test"
        assert payload.act.sub == "user123"
        return JsonResponse({"status": "ok"})

    response = await middleware(request, next_handler)  # type: ignore
    assert called
    assert response.status == 200


@pytest.mark.asyncio
async def test_jwt_middleware_dual_secret_current():
    """Test JWT middleware with dual secrets - token signed with current secret."""
    current_secret = "current-secret-minimum-32-characters-long"
    previous_secret = "previous-secret-minimum-32-characters-long"
    middleware = JWTMiddleware(current_secret, "svc-test", previous_secret)

    # Token signed with current secret
    token = create_jwt_token(current_secret, audience="svc-test")
    request = MockRequest(headers={"Authorization": f"Bearer {token}"})

    called = False

    async def next_handler(req: Request) -> JsonResponse:
        nonlocal called
        called = True
        return JsonResponse({"status": "ok"})

    response = await middleware(request, next_handler)  # type: ignore
    assert called
    assert response.status == 200


@pytest.mark.asyncio
async def test_jwt_middleware_dual_secret_previous():
    """Test JWT middleware with dual secrets - token signed with previous secret."""
    current_secret = "current-secret-minimum-32-characters-long"
    previous_secret = "previous-secret-minimum-32-characters-long"
    middleware = JWTMiddleware(current_secret, "svc-test", previous_secret)

    # Token signed with PREVIOUS secret (simulates rotation window)
    token = create_jwt_token(previous_secret, audience="svc-test")
    request = MockRequest(headers={"Authorization": f"Bearer {token}"})

    called = False

    async def next_handler(req: Request) -> JsonResponse:
        nonlocal called
        called = True
        # Verify token was accepted even though signed with previous secret
        assert hasattr(req, "_jwt_payload")
        payload: InternalJWT = req._jwt_payload  # type: ignore
        assert payload.aud == "svc-test"
        return JsonResponse({"status": "ok"})

    response = await middleware(request, next_handler)  # type: ignore
    assert called
    assert response.status == 200


@pytest.mark.asyncio
async def test_jwt_middleware_invalid_secret():
    """Test JWT middleware rejects token with invalid secret."""
    secret = "test-secret-minimum-32-characters-long-for-security"
    middleware = JWTMiddleware(secret, "svc-test")

    # Token signed with different secret
    wrong_secret = "wrong-secret-minimum-32-characters-long-for-test"
    token = create_jwt_token(wrong_secret, audience="svc-test")
    request = MockRequest(headers={"Authorization": f"Bearer {token}"})

    async def next_handler(req: Request) -> JsonResponse:
        pytest.fail("Should not reach next handler")
        return JsonResponse({})

    with pytest.raises(UnauthorizedError, match="Invalid token"):
        await middleware(request, next_handler)  # type: ignore


@pytest.mark.asyncio
async def test_jwt_middleware_dual_secret_rejects_invalid():
    """Test JWT middleware with dual secrets rejects token with neither secret."""
    current_secret = "current-secret-minimum-32-characters-long"
    previous_secret = "previous-secret-minimum-32-characters-long"
    middleware = JWTMiddleware(current_secret, "svc-test", previous_secret)

    # Token signed with completely different secret
    wrong_secret = "wrong-secret-minimum-32-characters-long-for-test"
    token = create_jwt_token(wrong_secret, audience="svc-test")
    request = MockRequest(headers={"Authorization": f"Bearer {token}"})

    async def next_handler(req: Request) -> JsonResponse:
        pytest.fail("Should not reach next handler")
        return JsonResponse({})

    with pytest.raises(UnauthorizedError, match="Invalid token"):
        await middleware(request, next_handler)  # type: ignore


@pytest.mark.asyncio
async def test_jwt_middleware_missing_authorization_header():
    """Test JWT middleware rejects request without Authorization header."""
    secret = "test-secret-minimum-32-characters-long-for-security"
    middleware = JWTMiddleware(secret, "svc-test")

    request = MockRequest(headers={})

    async def next_handler(req: Request) -> JsonResponse:
        pytest.fail("Should not reach next handler")
        return JsonResponse({})

    with pytest.raises(UnauthorizedError, match="Missing Authorization header"):
        await middleware(request, next_handler)  # type: ignore


@pytest.mark.asyncio
async def test_jwt_middleware_invalid_authorization_format():
    """Test JWT middleware rejects malformed Authorization header."""
    secret = "test-secret-minimum-32-characters-long-for-security"
    middleware = JWTMiddleware(secret, "svc-test")

    request = MockRequest(headers={"Authorization": "NotBearer token"})

    async def next_handler(req: Request) -> JsonResponse:
        pytest.fail("Should not reach next handler")
        return JsonResponse({})

    with pytest.raises(UnauthorizedError, match="Invalid Authorization header format"):
        await middleware(request, next_handler)  # type: ignore


@pytest.mark.asyncio
async def test_jwt_middleware_expired_token():
    """Test JWT middleware rejects expired token."""
    secret = "test-secret-minimum-32-characters-long-for-security"
    middleware = JWTMiddleware(secret, "svc-test")

    # Token expired 10 seconds ago
    token = create_jwt_token(secret, audience="svc-test", exp_delta=-10)
    request = MockRequest(headers={"Authorization": f"Bearer {token}"})

    async def next_handler(req: Request) -> JsonResponse:
        pytest.fail("Should not reach next handler")
        return JsonResponse({})

    with pytest.raises(UnauthorizedError, match="Token expired"):
        await middleware(request, next_handler)  # type: ignore


@pytest.mark.asyncio
async def test_jwt_middleware_wrong_audience():
    """Test JWT middleware rejects token with wrong audience."""
    secret = "test-secret-minimum-32-characters-long-for-security"
    middleware = JWTMiddleware(secret, "svc-test")

    # Token for different service
    token = create_jwt_token(secret, audience="svc-other")
    request = MockRequest(headers={"Authorization": f"Bearer {token}"})

    async def next_handler(req: Request) -> JsonResponse:
        pytest.fail("Should not reach next handler")
        return JsonResponse({})

    with pytest.raises(ForbiddenError, match="Invalid token audience"):
        await middleware(request, next_handler)  # type: ignore


@pytest.mark.asyncio
async def test_jwt_middleware_short_secret_rejected():
    """Test JWT middleware rejects secret that is too short."""
    with pytest.raises(ValueError, match="JWT secret must be at least 32 characters"):
        JWTMiddleware("short-secret", "svc-test")


@pytest.mark.asyncio
async def test_jwt_middleware_short_previous_secret_rejected():
    """Test JWT middleware rejects previous secret that is too short."""
    current_secret = "current-secret-minimum-32-characters-long"
    previous_secret = "short"

    with pytest.raises(ValueError, match="Previous JWT secret must be at least 32 characters"):
        JWTMiddleware(current_secret, "svc-test", previous_secret)


@pytest.mark.asyncio
async def test_rotation_scenario():
    """Test realistic secret rotation scenario.

    Simulates:
    1. Old secret in use
    2. Rotation happens (old becomes previous, new becomes current)
    3. Old tokens still work (signed with previous)
    4. New tokens work (signed with current)
    5. After rotation window, only new tokens work
    """
    old_secret = "old-secret-minimum-32-characters-long-for-test"
    new_secret = "new-secret-minimum-32-characters-long-for-test"

    # Step 1: Before rotation - single secret
    middleware_before = JWTMiddleware(old_secret, "svc-test")
    old_token = create_jwt_token(old_secret, audience="svc-test")

    async def next_handler(req: Request) -> JsonResponse:
        return JsonResponse({"status": "ok"})

    request_old = MockRequest(headers={"Authorization": f"Bearer {old_token}"})
    response = await middleware_before(request_old, next_handler)  # type: ignore
    assert response.status == 200

    # Step 2: During rotation - dual secrets (old = previous, new = current)
    middleware_rotation = JWTMiddleware(new_secret, "svc-test", old_secret)

    # Old token still works (signed with previous secret)
    request_old_during = MockRequest(headers={"Authorization": f"Bearer {old_token}"})
    response = await middleware_rotation(request_old_during, next_handler)  # type: ignore
    assert response.status == 200

    # New token works (signed with current secret)
    new_token = create_jwt_token(new_secret, audience="svc-test")
    request_new = MockRequest(headers={"Authorization": f"Bearer {new_token}"})
    response = await middleware_rotation(request_new, next_handler)  # type: ignore
    assert response.status == 200

    # Step 3: After rotation completes - only new secret
    middleware_after = JWTMiddleware(new_secret, "svc-test")

    # Old token fails (previous secret no longer accepted)
    request_old_after = MockRequest(headers={"Authorization": f"Bearer {old_token}"})
    with pytest.raises(UnauthorizedError):
        await middleware_after(request_old_after, next_handler)  # type: ignore

    # New token works
    request_new_after = MockRequest(headers={"Authorization": f"Bearer {new_token}"})
    response = await middleware_after(request_new_after, next_handler)  # type: ignore
    assert response.status == 200
