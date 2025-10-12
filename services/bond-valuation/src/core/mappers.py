"""Request/Response Mappers - Convert between JSON and domain types."""

from datetime import date
from typing import Any

from core.bond_types import (
    BondSpec,
    BondType,
    Cashflow,
    DayCount,
    Frequency,
    PricingResult,
    StubPosition,
)


def parse_date(date_str: str) -> date:
    """Parse ISO 8601 date string to date object.

    Args:
        date_str: ISO 8601 date string (YYYY-MM-DD)

    Returns:
        date object

    Raises:
        ValueError: If date string is invalid
    """
    try:
        return date.fromisoformat(date_str)
    except (ValueError, AttributeError) as e:
        raise ValueError(f"Invalid date format: {date_str}. Expected YYYY-MM-DD") from e


def parse_day_count(dc_str: str) -> DayCount:
    """Parse day count convention string to enum.

    Args:
        dc_str: Day count convention string

    Returns:
        DayCount enum value

    Raises:
        ValueError: If convention is not recognized
    """
    mapping = {
        "ACT_360": DayCount.ACT_360,
        "ACT_365F": DayCount.ACT_365F,
        "ACT_ACT_ICMA": DayCount.ACT_ACT_ICMA,
        "ACT_ACT_ISDA": DayCount.ACT_ACT_ICMA,  # Map ISDA to ICMA for now
        "30_360": DayCount.US_30_360,
        "30E_360": DayCount._30E_360,
    }
    if dc_str not in mapping:
        raise ValueError(
            f"Unknown day count convention: {dc_str}. " f"Supported: {', '.join(mapping.keys())}"
        )
    return mapping[dc_str]


def parse_frequency(freq: int) -> Frequency:
    """Parse frequency integer to enum.

    Args:
        freq: Frequency as integer (1, 2, 4, 12)

    Returns:
        Frequency enum value

    Raises:
        ValueError: If frequency is not supported
    """
    mapping = {
        1: Frequency.ANNUAL,
        2: Frequency.SEMI_ANNUAL,
        4: Frequency.QUARTERLY,
        12: Frequency.MONTHLY,
    }
    if freq not in mapping:
        raise ValueError(f"Invalid frequency: {freq}. Supported: 1, 2, 4, 12")
    return mapping[freq]


def parse_bond_type(type_str: str | None) -> BondType:
    """Parse bond type string to enum.

    Args:
        type_str: Bond type string (optional, defaults to REGULAR)

    Returns:
        BondType enum value
    """
    if not type_str or type_str.upper() == "REGULAR":
        return BondType.REGULAR
    elif type_str.upper() == "DISCOUNTED":
        return BondType.DISCOUNTED
    elif type_str.upper() in ("IAM", "INTEREST_AT_MATURITY"):
        return BondType.INTEREST_AT_MATURITY
    else:
        return BondType.REGULAR


def request_to_bond_spec(body: dict[str, Any]) -> BondSpec:
    """Convert HTTP request body to BondSpec.

    Args:
        body: Parsed JSON request body

    Returns:
        BondSpec domain object

    Raises:
        ValueError: If required fields are missing or invalid
    """
    settlement = parse_date(body["settlementDate"])
    maturity = parse_date(body["maturityDate"])
    day_count = parse_day_count(body["dayCount"])
    frequency = parse_frequency(body["frequency"])

    return BondSpec(
        settlement=settlement,
        maturity=maturity,
        issue_date=parse_date(body["issueDate"]) if "issueDate" in body else None,
        face=float(body.get("face", 100.0)),
        coupon_rate=float(body["couponRate"]),
        frequency=frequency,
        day_count=day_count,
        eom_rule=bool(body.get("eomRule", True)),
        stub_position=StubPosition.NONE,  # Simplified for now
        first_coupon=parse_date(body["firstCouponDate"]) if "firstCouponDate" in body else None,
        last_coupon=parse_date(body["lastCouponDate"]) if "lastCouponDate" in body else None,
        bond_type=parse_bond_type(body.get("bondType")),
    )


def pricing_result_to_response(
    result: PricingResult,
    cashflows: list[Cashflow] | None = None,
    version: str = "2025.10",
) -> dict[str, Any]:
    """Convert PricingResult to HTTP response body.

    Args:
        result: Pricing result domain object
        cashflows: Optional list of cashflows
        version: Service version string

    Returns:
        JSON-serializable dict
    """
    response = {
        "cleanPrice": round(result.clean, 6),
        "dirtyPrice": round(result.dirty, 6),
        "accruedInterest": round(result.accrued, 6),
        "yield": round(result.ytm, 6),
        "version": version,
    }

    if cashflows:
        response["cashflows"] = [
            {
                "date": cf.date.isoformat(),
                "amount": round(cf.amount, 6),
                "type": cf.type,
            }
            for cf in cashflows
        ]
        # Add next coupon date (first future cashflow)
        future_cfs = [cf for cf in cashflows if cf.type == "coupon"]
        if future_cfs:
            response["nextCouponDate"] = future_cfs[0].date.isoformat()

    return response
