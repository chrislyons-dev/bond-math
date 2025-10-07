"""Metrics Service - Cloudflare Python Worker

Duration, modified duration, convexity, and related risk measures for bonds.

This is a stub implementation that returns hardcoded responses to validate
the workers-py framework integration.
"""

import sys
from pathlib import Path

# Add workers-py library to path
lib_path = Path(__file__).parent.parent.parent.parent / "libs" / "workers-py" / "src"
sys.path.insert(0, str(lib_path))

from workers_py import WorkersApp, Request, JsonResponse, Field, validate_body
from workers_py.logging import StructuredLogger, LoggingMiddleware
from workers_py.errors import HttpError, UnauthorizedError

# Constants
SERVICE_NAME = "metrics"
SERVICE_VERSION = "2025.10"

# Initialize app and logger
app = WorkersApp()
logger = StructuredLogger(SERVICE_NAME)

# Add logging middleware
app.use(LoggingMiddleware(logger))


# Route handlers
@app.route("/health", methods=["GET"])
async def health_check(request: Request) -> JsonResponse:
    """Health check endpoint.

    Args:
        request: HTTP request

    Returns:
        Health status response
    """
    return JsonResponse(
        {
            "status": "healthy",
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
        }
    )


@app.route("/duration", methods=["POST"])
@validate_body(
    {
        "settlementDate": Field(type=str, required=True),
        "maturityDate": Field(type=str, required=True),
        "couponRate": Field(type=float, required=True, min_value=0, max_value=1),
        "frequency": Field(type=int, required=True, enum=[1, 2, 4, 12]),
        "face": Field(type=(int, float), required=True, min_value=0),
        "yield": Field(type=float, required=True),
        "dayCount": Field(
            type=str,
            required=True,
            enum=["ACT_360", "ACT_365F", "30_360", "30E_360", "ACT_ACT_ISDA", "ACT_ACT_ICMA"],
        ),
    }
)
async def calculate_duration(request: Request) -> JsonResponse:
    """Calculate duration and related metrics.

    This is a stub implementation returning hardcoded values.

    Args:
        request: HTTP request with bond parameters

    Returns:
        Duration metrics
    """
    # Verify authorization
    auth_header = request.header("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid authorization header")

    # Body is already validated by decorator
    body = await request.json()

    # Return hardcoded stub response
    request_id = request.header("x-request-id")
    logger.info(
        "Duration calculated",
        request_id=request_id,
        yield_value=body.get("yield"),
    )

    return JsonResponse(
        {
            "macaulayDuration": 4.523,
            "modifiedDuration": 4.415,
            "convexity": 23.456,
            "pv01": 0.0441,
            "dv01": 44.15,
            "version": SERVICE_VERSION,
        }
    )


@app.route("/convexity", methods=["POST"])
@validate_body(
    {
        "settlementDate": Field(type=str, required=True),
        "maturityDate": Field(type=str, required=True),
        "couponRate": Field(type=float, required=True, min_value=0, max_value=1),
        "frequency": Field(type=int, required=True, enum=[1, 2, 4, 12]),
        "face": Field(type=(int, float), required=True, min_value=0),
        "yield": Field(type=float, required=True),
        "dayCount": Field(
            type=str,
            required=True,
            enum=["ACT_360", "ACT_365F", "30_360", "30E_360", "ACT_ACT_ISDA", "ACT_ACT_ICMA"],
        ),
    }
)
async def calculate_convexity(request: Request) -> JsonResponse:
    """Calculate convexity metric.

    This is a stub implementation returning hardcoded values.

    Args:
        request: HTTP request with bond parameters

    Returns:
        Convexity metric
    """
    # Verify authorization
    auth_header = request.header("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid authorization header")

    # Body is already validated by decorator
    body = await request.json()

    # Return hardcoded stub response
    request_id = request.header("x-request-id")
    logger.info(
        "Convexity calculated",
        request_id=request_id,
    )

    return JsonResponse(
        {
            "convexity": 23.456,
            "version": SERVICE_VERSION,
        }
    )


@app.route("/risk", methods=["POST"])
@validate_body(
    {
        "settlementDate": Field(type=str, required=True),
        "maturityDate": Field(type=str, required=True),
        "couponRate": Field(type=float, required=True, min_value=0, max_value=1),
        "frequency": Field(type=int, required=True, enum=[1, 2, 4, 12]),
        "face": Field(type=(int, float), required=True, min_value=0),
        "yield": Field(type=float, required=True),
        "dayCount": Field(
            type=str,
            required=True,
            enum=["ACT_360", "ACT_365F", "30_360", "30E_360", "ACT_ACT_ISDA", "ACT_ACT_ICMA"],
        ),
        "bumpBasisPoints": Field(type=(int, float), required=False, min_value=0),
    }
)
async def calculate_risk_metrics(request: Request) -> JsonResponse:
    """Calculate comprehensive risk metrics.

    This is a stub implementation returning hardcoded values.

    Args:
        request: HTTP request with bond parameters and bump size

    Returns:
        Comprehensive risk metrics
    """
    # Verify authorization
    auth_header = request.header("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid authorization header")

    # Body is already validated by decorator
    body = await request.json()
    bump_bp = body.get("bumpBasisPoints", 1)

    # Return hardcoded stub response
    request_id = request.header("x-request-id")
    logger.info(
        "Risk metrics calculated",
        request_id=request_id,
        bump_bp=bump_bp,
    )

    return JsonResponse(
        {
            "macaulayDuration": 4.523,
            "modifiedDuration": 4.415,
            "effectiveDuration": 4.420,
            "convexity": 23.456,
            "effectiveConvexity": 23.512,
            "pv01": 0.0441,
            "dv01": 44.15,
            "bumpBasisPoints": bump_bp,
            "version": SERVICE_VERSION,
        }
    )


@app.error_handler
async def handle_error(error: Exception) -> JsonResponse:
    """Global error handler.

    Args:
        error: Exception that occurred

    Returns:
        Error response with appropriate status code
    """
    if isinstance(error, HttpError):
        response_data = {"error": error.message}
        if error.error_code:
            response_data["code"] = error.error_code
        return JsonResponse(response_data, status=error.status)

    # Unexpected error - log and return 500
    logger.error("Unhandled error", error=str(error), error_type=type(error).__name__)

    return JsonResponse(
        {"error": "Internal Server Error"},
        status=500,
    )


# Cloudflare Workers entry point
async def on_fetch(request):
    """Cloudflare Workers fetch handler.

    Args:
        request: Raw Cloudflare Workers request

    Returns:
        Cloudflare Workers response
    """
    response = await app.handle(request)
    return response.to_workers_response()
