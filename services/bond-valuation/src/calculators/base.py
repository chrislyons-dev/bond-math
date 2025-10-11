from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable

from ..schedule.builder import ScheduleBuilder
from ..types import BondSpec, BondType, Cashflow, DayCountFunc, PricingResult


def newton_raphson(
    f: Callable[[float], float],
    df: Callable[[float], float],
    x0: float,
    tol: float = 1e-10,
    max_iter: int = 100,
) -> float:
    x = x0
    for _ in range(max_iter):
        fx = f(x)
        dfx = df(x)
        if dfx == 0:
            raise RuntimeError("Zero derivative in Newton-Raphson.")
        step = fx / dfx
        x -= step
        if abs(step) < tol:
            return x
    raise RuntimeError("Newton-Raphson did not converge.")


class BondCalculator(ABC):
    def __init__(self, daycount: DayCountFunc, schedule_builder: ScheduleBuilder | None = None):
        self._yf = daycount
        self._sched = schedule_builder or ScheduleBuilder()

    @abstractmethod
    def price_from_yield(self, spec: BondSpec, ytm: float) -> PricingResult: ...
    @abstractmethod
    def yield_from_price(
        self, spec: BondSpec, clean_price: float, guess: float = 0.05
    ) -> PricingResult: ...
    @abstractmethod
    def cashflows(self, spec: BondSpec) -> list[Cashflow]: ...

    # Common accrued helper
    def accrued_interest(self, spec: BondSpec) -> float:
        if spec.bond_type == BondType.REGULAR:
            schedule = self._sched.build(spec)
            prev = max([d for d in schedule if d <= spec.settlement], default=None)
            nxt = min([d for d in schedule if d > spec.settlement], default=None)
            if prev is None or nxt is None:
                return 0.0
            yf_period = self._yf(prev, nxt, spec.day_count)
            yf_accr = self._yf(prev, spec.settlement, spec.day_count)
            coupon = spec.face * spec.coupon_rate / spec.frequency.value
            return coupon * (yf_accr / yf_period)
        elif spec.bond_type == BondType.INTEREST_AT_MATURITY:
            anchor = spec.issue_date or spec.settlement
            yf_accr = self._yf(anchor, spec.settlement, spec.day_count)
            return spec.face * spec.coupon_rate * yf_accr
        else:
            return 0.0
