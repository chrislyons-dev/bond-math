"""Pricing Service - Cloudflare Python Worker

Curve-based cashflow discounting engine for present value calculations.

@service pricing
@type cloudflare-worker-python
@layer business-logic
@description Curve-based cashflow discounting and present value calculations
@owner platform-team
@internal-routes /value, /scenario, /key-rate, /health
@dependencies none
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
from flarelette.errors import ValidationError

# Constants
SERVICE_NAME = "pricing"
SERVICE_VERSION = "2025.10"

# Initialize app with standard middleware, health check, and error handling
app, logger, on_fetch = create_worker_app(SERVICE_NAME, SERVICE_VERSION)


@app.route("/value", methods=["POST"])
@require_scopes("pricing:write")
@validate_body(
    {
        "asOf": Field(type=str, required=True),
        "cashflows": Field(type=list, required=True, min_length=1),
        "discountCurve": Field(type=dict, required=True),
        "currency": Field(type=str, required=False),
    }
)
async def calculate_present_value(request: Request) -> JsonResponse:
    """Calculate present value from cashflows and discount curve.

    This is a stub implementation returning hardcoded values.

    @endpoint POST /value
    @gateway-route POST /api/pricing/v1/value
    @authentication internal-jwt
    @scope pricing:write

    Args:
        request: HTTP request with cashflows and curve

    Returns:
        Present value calculation results
    """
    # Auth and validation handled by middleware/decorators
    body = await request.json()

    # Validate cashflows structure
    cashflows = body.get("cashflows", [])
    for idx, cf in enumerate(cashflows):
        if not isinstance(cf, dict):
            raise ValidationError(f"Cashflow at index {idx} must be an object")
        if "date" not in cf:
            raise ValidationError(f"Cashflow at index {idx} missing 'date' field")
        if "amount" not in cf:
            raise ValidationError(f"Cashflow at index {idx} missing 'amount' field")

    # Validate discount curve structure
    curve = body.get("discountCurve", {})
    if "nodes" not in curve:
        raise ValidationError("discountCurve missing 'nodes' field")

    # Return hardcoded stub response
    request_id = request.header("x-request-id")
    logger.info(
        "Present value calculated",
        request_id=request_id,
        cashflow_count=len(cashflows),
        curve_nodes=len(curve.get("nodes", [])),
    )

    return JsonResponse(
        {
            "pvTotal": 1025.47,
            "pvByLeg": [{"leg": "fixed", "pv": 1025.47}],
            "discountFactors": [
                {"date": "2026-01-01", "df": 0.9801},
                {"date": "2026-07-01", "df": 0.9608},
                {"date": "2030-07-01", "df": 0.8187},
            ],
            "currency": body.get("currency", "USD"),
            "asOf": body.get("asOf"),
            "version": SERVICE_VERSION,
        }
    )


@app.route("/scenario", methods=["POST"])
@require_scopes("pricing:write")
@validate_body(
    {
        "asOf": Field(type=str, required=True),
        "cashflows": Field(type=list, required=True, min_length=1),
        "discountCurve": Field(type=dict, required=True),
        "scenarios": Field(type=list, required=True, min_length=1),
    }
)
async def calculate_scenarios(request: Request) -> JsonResponse:
    """Calculate PV under multiple curve scenarios.

    This is a stub implementation returning hardcoded values.

    @endpoint POST /scenario
    @gateway-route POST /api/pricing/v1/scenario
    @authentication internal-jwt
    @scope pricing:write

    Args:
        request: HTTP request with scenarios

    Returns:
        PV for each scenario
    """
    # Auth and validation handled by middleware/decorators
    body = await request.json()

    scenarios = body.get("scenarios", [])

    # Return hardcoded stub response
    request_id = request.header("x-request-id")
    logger.info(
        "Scenario analysis calculated",
        request_id=request_id,
        scenario_count=len(scenarios),
    )

    return JsonResponse(
        {
            "scenarios": [
                {"name": "base", "pvTotal": 1025.47, "shift": 0},
                {"name": "up_50bp", "pvTotal": 1015.32, "shift": 50},
                {"name": "down_50bp", "pvTotal": 1035.89, "shift": -50},
            ],
            "asOf": body.get("asOf"),
            "version": SERVICE_VERSION,
        }
    )


@app.route("/key-rate", methods=["POST"])
@require_scopes("pricing:write")
@validate_body(
    {
        "asOf": Field(type=str, required=True),
        "cashflows": Field(type=list, required=True, min_length=1),
        "discountCurve": Field(type=dict, required=True),
        "bumpBasisPoints": Field(type=(int, float), required=False, min_value=0),
    }
)
async def calculate_key_rate_pv01(request: Request) -> JsonResponse:
    """Calculate key rate PV01 sensitivities.

    This is a stub implementation returning hardcoded values.

    @endpoint POST /key-rate
    @gateway-route POST /api/pricing/v1/key-rate
    @authentication internal-jwt
    @scope pricing:write

    Args:
        request: HTTP request with curve and bump size

    Returns:
        Key rate sensitivities
    """
    # Auth and validation handled by middleware/decorators
    body = await request.json()
    bump_bp = body.get("bumpBasisPoints", 1)

    # Return hardcoded stub response
    request_id = request.header("x-request-id")
    logger.info(
        "Key rate PV01 calculated",
        request_id=request_id,
        bump_bp=bump_bp,
    )

    return JsonResponse(
        {
            "pvTotal": 1025.47,
            "keyRates": [
                {"tenor": "1Y", "pv01": 0.15},
                {"tenor": "2Y", "pv01": 0.28},
                {"tenor": "5Y", "pv01": 0.52},
                {"tenor": "10Y", "pv01": 0.31},
            ],
            "totalPV01": 1.26,
            "bumpBasisPoints": bump_bp,
            "version": SERVICE_VERSION,
        }
    )
