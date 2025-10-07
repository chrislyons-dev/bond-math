"""Service factory and helpers for Cloudflare Python Workers.

Reduces boilerplate by providing standard setup for authentication, logging,
health checks, and error handling.
"""

import os
from typing import Any

from .app import App
from .auth import JWTMiddleware
from .errors import HttpError
from .logging import LoggingMiddleware, StructuredLogger
from .request import Request
from .response import JsonResponse


def create_app(
    service_name: str,
    version: str,
    *,
    enable_health_check: bool = True,
    enable_auth: bool = True,
    enable_logging: bool = True,
) -> tuple[App, StructuredLogger]:
    """Create a service app with standard middleware.

    Args:
        service_name: Service identifier (e.g., "bond-valuation")
        version: Service version (e.g., "2025.10")
        enable_health_check: Auto-register /health endpoint
        enable_auth: Enable JWT authentication middleware
        enable_logging: Enable structured logging middleware

    Returns:
        Tuple of (app, logger) for service use

    Example:
        app, logger = create_app("bond-valuation", "2025.10")

        @app.route("/price", methods=["POST"])
        @require_scopes("valuation:write")
        async def calculate_price(request: Request) -> JsonResponse:
            return JsonResponse({"price": 99.948})
    """
    app = App()
    logger = StructuredLogger(service_name)

    # Add logging middleware
    if enable_logging:
        app.use(LoggingMiddleware(logger))

    # Add JWT authentication middleware
    if enable_auth:
        jwt_secret = os.environ.get("INTERNAL_JWT_SECRET")
        if jwt_secret:
            app.use(JWTMiddleware(jwt_secret, f"svc-{service_name}"))
        else:
            logger.warn("INTERNAL_JWT_SECRET not configured - authentication disabled")

    # Register default error handler
    @app.error_handler
    async def handle_error(error: Exception) -> JsonResponse:
        """Default error handler for all services."""
        if isinstance(error, HttpError):
            response_data: dict[str, Any] = {"error": error.message}
            if error.error_code:
                response_data["code"] = error.error_code
            return JsonResponse(response_data, status=error.status)

        # Unexpected error - log and return 500
        logger.error("Unhandled error", error=str(error), error_type=type(error).__name__)
        return JsonResponse({"error": "Internal Server Error"}, status=500)

    # Auto-register health check endpoint
    if enable_health_check:

        @app.route("/health", methods=["GET"])
        async def health_check(request: Request) -> JsonResponse:
            """Health check endpoint."""
            return JsonResponse(
                {
                    "status": "healthy",
                    "service": service_name,
                    "version": version,
                }
            )

    return app, logger


def create_worker_handler(app: App) -> Any:
    """Create Cloudflare Workers entry point for an app.

    Args:
        app: Microapi App instance

    Returns:
        Worker handler function

    Example:
        app, logger = create_app("bond-valuation", "2025.10")

        # ... register routes ...

        # Export for Cloudflare Workers
        on_fetch = create_worker_handler(app)
    """

    async def on_fetch(request: object) -> object:
        """Cloudflare Workers fetch handler."""
        response = await app.handle(request)
        return response.to_workers_response()

    return on_fetch


def create_worker_app(
    service_name: str,
    version: str,
    *,
    enable_health_check: bool = True,
    enable_auth: bool = True,
    enable_logging: bool = True,
) -> tuple[App, StructuredLogger, Any]:
    """Create a service app with standard middleware and worker handler.

    Convenience function that combines create_app and create_worker_handler.

    Args:
        service_name: Service identifier (e.g., "bond-valuation")
        version: Service version (e.g., "2025.10")
        enable_health_check: Auto-register /health endpoint
        enable_auth: Enable JWT authentication middleware
        enable_logging: Enable structured logging middleware

    Returns:
        Tuple of (app, logger, on_fetch) for service use

    Example:
        app, logger, on_fetch = create_worker_app("bond-valuation", "2025.10")

        @app.route("/price", methods=["POST"])
        @require_scopes("valuation:write")
        async def calculate_price(request: Request) -> JsonResponse:
            return JsonResponse({"price": 99.948})

        # on_fetch is already exported for Cloudflare Workers
    """
    app, logger = create_app(
        service_name,
        version,
        enable_health_check=enable_health_check,
        enable_auth=enable_auth,
        enable_logging=enable_logging,
    )
    on_fetch = create_worker_handler(app)
    return app, logger, on_fetch
