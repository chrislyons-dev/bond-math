from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from enum import Enum, auto


class DayCount(Enum):
    ACT_ACT_ICMA = auto()
    ACT_365F = auto()
    ACT_360 = auto()
    _30E_360 = auto()
    US_30_360 = auto()


class Frequency(Enum):
    ANNUAL = 1
    SEMI_ANNUAL = 2
    QUARTERLY = 4
    MONTHLY = 12


class StubPosition(Enum):
    NONE = auto()
    SHORT_FIRST = auto()
    LONG_FIRST = auto()
    SHORT_LAST = auto()
    LONG_LAST = auto()


class BondType(Enum):
    DISCOUNTED = auto()
    INTEREST_AT_MATURITY = auto()
    REGULAR = auto()


@dataclass(frozen=True)
class BondSpec:
    settlement: date
    maturity: date
    issue_date: date | None = None
    face: float = 100.0
    coupon_rate: float = 0.0  # nominal annual
    frequency: Frequency = Frequency.SEMI_ANNUAL
    day_count: DayCount = DayCount.ACT_ACT_ICMA
    eom_rule: bool = True
    stub_position: StubPosition = StubPosition.NONE
    first_coupon: date | None = None
    last_coupon: date | None = None
    bond_type: BondType = BondType.REGULAR


@dataclass(frozen=True)
class PricingResult:
    clean: float
    dirty: float
    accrued: float
    ytm: float


@dataclass(frozen=True)
class Cashflow:
    date: date
    amount: float
    type: str  # "coupon" | "redemption" | "interest"


# Day-count function type
DayCountFunc = Callable[[date, date, DayCount], float]
