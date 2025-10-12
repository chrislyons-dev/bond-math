"""Metrics Service - Cloudflare Python Worker

Duration, modified duration, convexity, and related risk measures for bonds.

@service metrics
@type cloudflare-worker-python
@layer business-logic
@description Bond risk metrics (duration, convexity, PV01, DV01)
@owner platform-team
@internal-routes /duration, /convexity, /risk, /health
@dependencies svc-bond-valuation
@security-model internal-jwt
@sla-tier high

This is a stub implementation that returns hardcoded responses to validate
the microapi framework integration.
"""

from flarelette import (
    Field,
    JsonResponse,
    Request,
    create_worker_app,
    require_scopes,
    validate_body,
)

# Constants
SERVICE_NAME = "metrics"
SERVICE_VERSION = "2025.10"

# Initialize app with standard middleware, health check, and error handling
app, logger, on_fetch = create_worker_app(SERVICE_NAME, SERVICE_VERSION)


@app.route("/duration", methods=["POST"])
@require_scopes("metrics:write")
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

    @endpoint POST /duration
    @gateway-route POST /api/metrics/v1/duration
    @authentication internal-jwt
    @scope metrics:write

    Args:
        request: HTTP request with bond parameters

    Returns:
        Duration metrics
    """
    # Auth and validation handled by middleware/decorators
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
@require_scopes("metrics:write")
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

    @endpoint POST /convexity
    @gateway-route POST /api/metrics/v1/convexity
    @authentication internal-jwt
    @scope metrics:write

    Args:
        request: HTTP request with bond parameters

    Returns:
        Convexity metric
    """
    # Auth and validation handled by middleware/decorators
    _ = await request.json()

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
@require_scopes("metrics:write")
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

    @endpoint POST /risk
    @gateway-route POST /api/metrics/v1/risk
    @authentication internal-jwt
    @scope metrics:write

    Args:
        request: HTTP request with bond parameters and bump size

    Returns:
        Comprehensive risk metrics
    """
    # Auth and validation handled by middleware/decorators
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
