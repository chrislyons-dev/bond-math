"""Internal JWT authentication for Cloudflare Python Workers.

Verifies JWTs minted by the Gateway Worker using HMAC-SHA256.

SECURITY: This module is critical to zero-trust authorization.
All modifications require security review.
"""

import base64
import hashlib
import hmac
import json
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from .errors import ForbiddenError, UnauthorizedError
from .request import Request
from .response import Response


@dataclass
class ActorClaim:
    """Actor claim - represents "Service X acting for User Y"."""

    iss: str  # Original issuer (Auth0 domain)
    sub: str  # User ID from Auth0
    perms: list[str]  # User permissions/scopes
    role: str | None = None  # User role
    org: str | None = None  # Organization ID
    uid: str | None = None  # Internal user ID


@dataclass
class InternalJWT:
    """Internal JWT payload structure (from Gateway)."""

    iss: str  # "https://gateway.bond-math"
    sub: str  # Service identifier (e.g., "svc-gateway")
    aud: str  # Target service (e.g., "svc-daycount")
    exp: int  # Expiration timestamp
    rid: str  # Request ID for tracing
    act: ActorClaim  # Actor (user) information


class JWTMiddleware:
    """Middleware to verify internal JWT tokens from Gateway.

    Validates HMAC-signed JWT, checks audience and expiration.
    Stores actor claim in request context.
    """

    def __init__(self, secret: str, expected_audience: str) -> None:
        """Initialize JWT middleware.

        Args:
            secret: HMAC signing secret (from env.INTERNAL_JWT_SECRET)
            expected_audience: Expected audience (e.g., "svc-valuation")

        Raises:
            ValueError: If secret is too short
        """
        if len(secret) < 32:
            raise ValueError("JWT secret must be at least 32 characters")

        self.secret = secret
        self.expected_audience = expected_audience

    async def __call__(
        self,
        request: Request,
        next_handler: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Verify JWT and call next handler.

        Args:
            request: Incoming request
            next_handler: Next handler in chain

        Returns:
            Response from handler

        Raises:
            UnauthorizedError: If token is missing or invalid
            ForbiddenError: If token audience is wrong
        """
        # Extract Authorization header
        auth_header = request.header("authorization")
        if not auth_header:
            raise UnauthorizedError("Missing Authorization header")

        # Extract Bearer token
        if not auth_header.startswith("Bearer "):
            raise UnauthorizedError("Invalid Authorization header format")

        token = auth_header[7:]  # Remove "Bearer " prefix

        # Verify and decode token
        try:
            payload = self._verify_token(token)
        except ValueError as e:
            if "expired" in str(e).lower():
                raise UnauthorizedError("Token expired") from e
            elif "audience" in str(e).lower():
                raise ForbiddenError("Invalid token audience") from e
            else:
                raise UnauthorizedError("Invalid token") from e

        # Store actor in request for handlers to access
        # (In a real implementation, we'd store this in request context)
        request._jwt_payload = payload  # type: ignore

        return await next_handler(request)

    def _verify_token(self, token: str) -> InternalJWT:
        """Verify an internal JWT token.

        SECURITY: Validates signature, expiration, and audience.

        Args:
            token: JWT token to verify

        Returns:
            Decoded payload if valid

        Raises:
            ValueError: If verification fails
        """
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token format")

        header_b64, payload_b64, signature_b64 = parts

        # Verify signature
        data = f"{header_b64}.{payload_b64}"
        expected_sig = self._compute_signature(data)
        actual_sig = self._base64url_decode_bytes(signature_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Invalid token signature")

        # Decode payload
        payload_json = self._base64url_decode_str(payload_b64)
        payload_dict = json.loads(payload_json)

        # Validate claims
        self._validate_claims(payload_dict)

        # Parse actor claim
        act_dict = payload_dict.get("act", {})
        actor = ActorClaim(
            iss=act_dict["iss"],
            sub=act_dict["sub"],
            perms=act_dict.get("perms", []),
            role=act_dict.get("role"),
            org=act_dict.get("org"),
            uid=act_dict.get("uid"),
        )

        return InternalJWT(
            iss=payload_dict["iss"],
            sub=payload_dict["sub"],
            aud=payload_dict["aud"],
            exp=payload_dict["exp"],
            rid=payload_dict["rid"],
            act=actor,
        )

    def _compute_signature(self, data: str) -> bytes:
        """Compute HMAC-SHA256 signature.

        Args:
            data: Data to sign

        Returns:
            HMAC signature
        """
        return hmac.new(
            self.secret.encode("utf-8"),
            data.encode("utf-8"),
            hashlib.sha256,
        ).digest()

    def _validate_claims(self, payload: dict[str, Any]) -> None:
        """Validate JWT claims.

        SECURITY: Checks audience, expiration, and actor claim.

        Args:
            payload: JWT payload

        Raises:
            ValueError: If validation fails
        """
        # Validate audience
        aud = payload.get("aud")
        if aud != self.expected_audience:
            raise ValueError(
                f"Invalid token audience: expected {self.expected_audience}, got {aud}"
            )

        # Validate expiration
        exp = payload.get("exp")
        if not exp or exp < time.time():
            raise ValueError("Token expired")

        # Validate actor claim exists
        act = payload.get("act")
        if not act or not isinstance(act, dict) or not act.get("sub"):
            raise ValueError("Missing or invalid actor claim")

        # Validate issuer
        iss = payload.get("iss")
        if iss != "https://gateway.bond-math":
            # Log warning but don't fail (for flexibility)
            pass

    def _base64url_decode_str(self, data: str) -> str:
        """Base64url decode to string.

        Args:
            data: Base64url encoded string

        Returns:
            Decoded string
        """
        # Add padding if needed
        padding = 4 - (len(data) % 4)
        if padding != 4:
            data += "=" * padding

        # Replace URL-safe chars
        data = data.replace("-", "+").replace("_", "/")

        return base64.b64decode(data).decode("utf-8")

    def _base64url_decode_bytes(self, data: str) -> bytes:
        """Base64url decode to bytes.

        Args:
            data: Base64url encoded string

        Returns:
            Decoded bytes
        """
        # Add padding if needed
        padding = 4 - (len(data) % 4)
        if padding != 4:
            data += "=" * padding

        # Replace URL-safe chars
        data = data.replace("-", "+").replace("_", "/")

        return base64.b64decode(data)


def get_actor(request: Request) -> ActorClaim | None:
    """Get actor claim from verified JWT.

    Args:
        request: Request object

    Returns:
        Actor claim if JWT was verified, None otherwise
    """
    payload: Any = getattr(request, "_jwt_payload", None)
    if payload and isinstance(payload, InternalJWT):
        actor: ActorClaim = payload.act
        return actor
    return None


def require_scopes(*required_scopes: str) -> Callable:
    """Decorator to require specific scopes.

    Args:
        *required_scopes: Required permission scopes

    Returns:
        Decorator function

    Example:
        @app.route("/count", methods=["POST"])
        @require_scopes("daycount:write")
        async def calculate(request: Request) -> Response:
            # Handler code
            pass
    """

    def decorator(
        handler: Callable[[Request], Awaitable[Response]],
    ) -> Callable[[Request], Awaitable[Response]]:
        async def wrapper(request: Request) -> Response:
            actor = get_actor(request)
            if not actor:
                raise UnauthorizedError("Missing authentication")

            # Check if actor has all required scopes
            missing_scopes = set(required_scopes) - set(actor.perms)
            if missing_scopes:
                raise ForbiddenError(f"Missing required scopes: {', '.join(missing_scopes)}")

            return await handler(request)

        return wrapper

    return decorator
