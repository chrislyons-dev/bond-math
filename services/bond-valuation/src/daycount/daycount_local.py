"""Local Day Count Implementations - Simple synchronous year fraction calculations.

These are lightweight implementations to support the bond calculators.
For production, consider calling the authoritative daycount service.
"""

from datetime import date

from ..types import DayCount


def calculate_year_fraction(start: date, end: date, convention: DayCount) -> float:
    """Calculate year fraction using the specified convention.

    Args:
        start: Start date
        end: End date
        convention: Day count convention

    Returns:
        Year fraction as float
    """
    if convention == DayCount.ACT_360:
        return _act_360(start, end)
    elif convention == DayCount.ACT_365F:
        return _act_365f(start, end)
    elif convention == DayCount.ACT_ACT_ICMA:
        return _act_act_icma(start, end)
    elif convention == DayCount._30E_360:
        return _30e_360(start, end)
    elif convention == DayCount.US_30_360:
        return _30_360(start, end)
    else:
        raise ValueError(f"Unsupported day count convention: {convention}")


def _act_360(start: date, end: date) -> float:
    """ACT/360 - Actual days / 360."""
    days = (end - start).days
    return days / 360.0


def _act_365f(start: date, end: date) -> float:
    """ACT/365F - Actual days / 365."""
    days = (end - start).days
    return days / 365.0


def _act_act_icma(start: date, end: date) -> float:
    """ACT/ACT ICMA - Actual days / Actual days in period.

    Simplified: assumes annual compounding for year fraction.
    For proper ICMA, need reference period from bond spec.
    """
    days = (end - start).days
    # Simple approximation - for precise ICMA need reference dates
    return days / 365.25


def _30e_360(start: date, end: date) -> float:
    """30E/360 - European 30/360."""
    d1 = min(start.day, 30)
    d2 = min(end.day, 30)

    days = 360 * (end.year - start.year) + 30 * (end.month - start.month) + (d2 - d1)
    return days / 360.0


def _30_360(start: date, end: date) -> float:
    """30/360 US - US 30/360 (Bond Basis)."""
    d1 = start.day
    d2 = end.day

    # Adjust d1
    if d1 == 31:
        d1 = 30

    # Adjust d2
    if d2 == 31 and d1 >= 30:
        d2 = 30

    days = 360 * (end.year - start.year) + 30 * (end.month - start.month) + (d2 - d1)
    return days / 360.0
