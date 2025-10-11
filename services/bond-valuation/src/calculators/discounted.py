from __future__ import annotations

from ..types import BondSpec, Cashflow, PricingResult
from .base import BondCalculator


class DiscountedCalculator(BondCalculator):
    """Money-market style discounting: no coupons."""

    def price_from_yield(self, spec: BondSpec, ytm: float) -> PricingResult:
        Y = self._yf(spec.settlement, spec.maturity, spec.day_count)
        dirty = spec.face / (1 + ytm * Y)
        accrued = 0.0
        return PricingResult(clean=dirty, dirty=dirty, accrued=accrued, ytm=ytm)

    def yield_from_price(
        self, spec: BondSpec, clean_price: float, guess: float = 0.05
    ) -> PricingResult:
        Y = self._yf(spec.settlement, spec.maturity, spec.day_count)
        y = (spec.face / clean_price - 1) / Y
        return self.price_from_yield(spec, y)

    def cashflows(self, spec: BondSpec) -> list[Cashflow]:
        return [Cashflow(date=spec.maturity, amount=spec.face, type="redemption")]
