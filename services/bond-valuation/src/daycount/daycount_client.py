"""Daycount Service Client - Calls daycount service via service binding.

Makes HTTP calls to the daycount service to get year fractions for date pairs.
"""

from collections.abc import Awaitable, Callable
from datetime import date
from typing import Any

from core.bond_types import DayCount
from flarelette import Request


def _map_convention(dc: DayCount) -> str:
    """Map internal DayCount enum to daycount service convention string."""
    mapping = {
        DayCount.ACT_ACT_ICMA: "ACT_ACT_ICMA",
        DayCount.ACT_365F: "ACT_365F",
        DayCount.ACT_360: "ACT_360",
        DayCount._30E_360: "30E_360",
        DayCount.US_30_360: "30_360",
    }
    return mapping[dc]


async def calculate_year_fraction(
    request: Request,
    start: date,
    end: date,
    convention: DayCount,
) -> float:
    """Calculate year fraction for a single date pair.

    Args:
        request: HTTP request (contains service binding in env)
        start: Start date
        end: End date
        convention: Day count convention

    Returns:
        Year fraction as float

    Raises:
        RuntimeError: If daycount service call fails
    """
    env = request.env
    if not hasattr(env, "SVC_DAYCOUNT"):
        raise RuntimeError("Daycount service binding not available (SVC_DAYCOUNT)")

    # Prepare request body
    body = {
        "pairs": [
            {
                "start": start.isoformat(),
                "end": end.isoformat(),
            }
        ],
        "convention": _map_convention(convention),
    }

    # Call daycount service via service binding
    svc_daycount = env.SVC_DAYCOUNT
    response = await svc_daycount.fetch(
        "/count",
        {
            "method": "POST",
            "headers": {
                "Content-Type": "application/json",
                # Internal JWT will be added by gateway
            },
            "body": str(body),  # JSON encode
        },
    )

    if not response.ok:
        error_text = await response.text()
        raise RuntimeError(f"Daycount service returned {response.status}: {error_text}")

    # Parse response
    result: Any = await response.json()
    if "results" not in result or len(result["results"]) == 0:
        raise RuntimeError("Daycount service returned empty results")

    return float(result["results"][0]["yearFraction"])


def create_daycount_function(
    request: Request,
) -> Callable[[date, date, DayCount], Awaitable[float]]:
    """Create a DayCountFunc closure that captures the request.

    This allows the calculators to call daycount service without
    needing to pass the request around.

    Args:
        request: HTTP request with service binding

    Returns:
        Async function (start, end, convention) -> year_fraction
    """

    async def daycount_func(start: date, end: date, convention: DayCount) -> float:
        return await calculate_year_fraction(request, start, end, convention)

    return daycount_func
