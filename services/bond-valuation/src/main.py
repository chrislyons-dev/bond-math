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

from core.factory import CalculatorFactory
from core.mappers import pricing_result_to_response, request_to_bond_spec
from daycount import calculate_year_fraction
from flarelette import (
    Field,
    JsonResponse,
    Request,
    create_worker_app,
    require_scopes,
    validate_body,
)

# Constants
SERVICE_NAME = "bond-valuation"
SERVICE_VERSION = "2025.10"

# Initialize app with standard middleware, health check, and error handling
app, logger, on_fetch = create_worker_app(SERVICE_NAME, SERVICE_VERSION)

# Initialize calculator factory with local daycount function
calculator_factory = CalculatorFactory(daycount=calculate_year_fraction)


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
    request_id = request.header("x-request-id")

    try:
        # Parse request to BondSpec
        bond_spec = request_to_bond_spec(body)
        ytm = float(body["yield"])

        # Get appropriate calculator for bond type
        calculator = calculator_factory.get(bond_spec.bond_type)

        # Calculate price from yield
        result = calculator.price_from_yield(bond_spec, ytm)

        # Get cashflows
        cashflows = calculator.cashflows(bond_spec)

        logger.info(
            "Price calculated",
            request_id=request_id,
            ytm=ytm,
            clean_price=result.clean,
            bond_type=bond_spec.bond_type.name,
        )

        # Convert to response
        response_body = pricing_result_to_response(result, cashflows, SERVICE_VERSION)
        return JsonResponse(response_body)

    except (ValueError, KeyError) as e:
        logger.error("Price calculation failed", request_id=request_id, error=str(e))
        return JsonResponse(
            {
                "type": "https://bondmath.chrislyons.dev/errors/validation-error",
                "title": "Validation Error",
                "status": 400,
                "detail": str(e),
            },
            status=400,
        )
    except Exception as e:
        logger.error("Price calculation error", request_id=request_id, error=str(e))
        return JsonResponse(
            {
                "type": "https://bondmath.chrislyons.dev/errors/internal-error",
                "title": "Internal Server Error",
                "status": 500,
                "detail": "Price calculation failed",
            },
            status=500,
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
    request_id = request.header("x-request-id")

    try:
        # Parse request to BondSpec
        bond_spec = request_to_bond_spec(body)
        clean_price = float(body["price"])

        # Get appropriate calculator for bond type
        calculator = calculator_factory.get(bond_spec.bond_type)

        # Calculate yield from price (uses Newton-Raphson)
        result = calculator.yield_from_price(bond_spec, clean_price)

        # Get cashflows
        cashflows = calculator.cashflows(bond_spec)

        logger.info(
            "Yield calculated",
            request_id=request_id,
            clean_price=clean_price,
            ytm=result.ytm,
            bond_type=bond_spec.bond_type.name,
        )

        # Convert to response
        response_body = pricing_result_to_response(result, cashflows, SERVICE_VERSION)
        return JsonResponse(response_body)

    except (ValueError, KeyError) as e:
        logger.error("Yield calculation failed", request_id=request_id, error=str(e))
        return JsonResponse(
            {
                "type": "https://bondmath.chrislyons.dev/errors/validation-error",
                "title": "Validation Error",
                "status": 400,
                "detail": str(e),
            },
            status=400,
        )
    except Exception as e:
        logger.error("Yield calculation error", request_id=request_id, error=str(e))
        return JsonResponse(
            {
                "type": "https://bondmath.chrislyons.dev/errors/internal-error",
                "title": "Internal Server Error",
                "status": 500,
                "detail": "Yield calculation failed",
            },
            status=500,
        )
