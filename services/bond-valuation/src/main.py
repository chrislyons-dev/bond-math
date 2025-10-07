"""Bond Valuation Service - Cloudflare Python Worker

Clean/dirty price ↔ yield calculations and cashflow schedule generation.

@service bond-valuation
@type cloudflare-worker-python
@layer business-logic
@description Price ↔ yield calculations and cashflow generation for bullet bonds
@owner platform-team
@internal-routes /price, /yield, /health
@dependencies svc-daycount
@security-model internal-jwt
@sla-tier high

This is a stub implementation that returns hardcoded responses to validate
the microapi framework integration.
"""

import os
import sys
from pathlib import Path

# Add microapi library to path
lib_path = Path(__file__).parent.parent.parent.parent / "libs" / "microapi" / "src"
sys.path.insert(0, str(lib_path))

from microapi import (
    App,
    Field,
    JsonResponse,
    JWTMiddleware,
    Request,
    require_scopes,
    validate_body,
)
from microapi.errors import HttpError
from microapi.logging import LoggingMiddleware, StructuredLogger

# Constants
SERVICE_NAME = "bond-valuation"
SERVICE_VERSION = "2025.10"

# Initialize app and logger
app = App()
logger = StructuredLogger(SERVICE_NAME)

# Add logging middleware
app.use(LoggingMiddleware(logger))

# Add JWT authentication middleware
# Secret comes from Cloudflare Workers environment (env.INTERNAL_JWT_SECRET)
jwt_secret = os.environ.get("INTERNAL_JWT_SECRET")
if jwt_secret:
    app.use(JWTMiddleware(jwt_secret, f"svc-{SERVICE_NAME}"))
else:
    logger.warn("INTERNAL_JWT_SECRET not configured - authentication disabled")


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


@app.route("/price", methods=["POST"])
@require_scopes("valuation:write")
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
        "eomRule": Field(type=bool, required=False),
        "firstCouponDate": Field(type=str, required=False),
        "lastCouponDate": Field(type=str, required=False),
    }
)
async def calculate_price(request: Request) -> JsonResponse:
    """Calculate clean/dirty price from yield.

    This is a stub implementation returning hardcoded values.

    @endpoint POST /price
    @gateway-route POST /api/valuation/v1/price
    @authentication internal-jwt
    @scope valuation:write

    Args:
        request: HTTP request with bond parameters and yield

    Returns:
        Price calculation results
    """
    # Auth and validation handled by middleware/decorators
    body = await request.json()

    # Return hardcoded stub response
    request_id = request.header("x-request-id")
    logger.info(
        "Price calculated",
        request_id=request_id,
        yield_value=body.get("yield"),
    )

    return JsonResponse(
        {
            "cleanPrice": 99.948,
            "dirtyPrice": 100.573,
            "accruedInterest": 0.625,
            "nextCouponDate": "2025-12-31",
            "cashflows": [
                {"date": "2025-12-31", "amount": 2.5},
                {"date": "2026-06-30", "amount": 2.5},
                {"date": "2026-12-31", "amount": 2.5},
                {"date": "2027-06-30", "amount": 2.5},
                {"date": "2027-12-31", "amount": 2.5},
                {"date": "2028-06-30", "amount": 2.5},
                {"date": "2028-12-31", "amount": 2.5},
                {"date": "2029-06-30", "amount": 2.5},
                {"date": "2029-12-31", "amount": 2.5},
                {"date": "2030-07-01", "amount": 102.5},
            ],
            "version": SERVICE_VERSION,
        }
    )


@app.route("/yield", methods=["POST"])
@require_scopes("valuation:write")
@validate_body(
    {
        "settlementDate": Field(type=str, required=True),
        "maturityDate": Field(type=str, required=True),
        "couponRate": Field(type=float, required=True, min_value=0, max_value=1),
        "frequency": Field(type=int, required=True, enum=[1, 2, 4, 12]),
        "face": Field(type=(int, float), required=True, min_value=0),
        "price": Field(type=float, required=True, min_value=0),
        "dayCount": Field(
            type=str,
            required=True,
            enum=["ACT_360", "ACT_365F", "30_360", "30E_360", "ACT_ACT_ISDA", "ACT_ACT_ICMA"],
        ),
        "eomRule": Field(type=bool, required=False),
        "firstCouponDate": Field(type=str, required=False),
        "lastCouponDate": Field(type=str, required=False),
    }
)
async def calculate_yield(request: Request) -> JsonResponse:
    """Calculate yield from clean price.

    This is a stub implementation returning hardcoded values.

    @endpoint POST /yield
    @gateway-route POST /api/valuation/v1/yield
    @authentication internal-jwt
    @scope valuation:write

    Args:
        request: HTTP request with bond parameters and price

    Returns:
        Yield calculation results
    """
    # Auth and validation handled by middleware/decorators
    body = await request.json()

    # Return hardcoded stub response
    request_id = request.header("x-request-id")
    logger.info(
        "Yield calculated",
        request_id=request_id,
        price=body.get("price"),
    )

    return JsonResponse(
        {
            "yield": 0.048,
            "cleanPrice": body.get("price"),
            "dirtyPrice": body.get("price", 99.948) + 0.625,
            "accruedInterest": 0.625,
            "nextCouponDate": "2025-12-31",
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
async def on_fetch(request: object) -> object:
    """Cloudflare Workers fetch handler.

    Args:
        request: Raw Cloudflare Workers request

    Returns:
        Cloudflare Workers response
    """
    response = await app.handle(request)
    return response.to_workers_response()
