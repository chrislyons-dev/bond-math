from __future__ import annotations

from ..types import BondSpec, Cashflow, PricingResult
from .base import BondCalculator, newton_raphson


class InterestAtMaturityCalculator(BondCalculator):
    def price_from_yield(self, spec: BondSpec, ytm: float) -> PricingResult:
        coupon_anchor = spec.issue_date or spec.settlement
        Y_coupon = self._yf(coupon_anchor, spec.maturity, spec.day_count)
        redemption = spec.face * (1 + spec.coupon_rate * Y_coupon)
        Y_discount = self._yf(spec.settlement, spec.maturity, spec.day_count)
        dirty = redemption / (1 + ytm * Y_discount)
        accrued = super().accrued_interest(spec)
        return PricingResult(clean=dirty - accrued, dirty=dirty, accrued=accrued, ytm=ytm)

    def yield_from_price(
        self, spec: BondSpec, clean_price: float, guess: float = 0.05
    ) -> PricingResult:
        accrued = super().accrued_interest(spec)
        target_dirty = clean_price + accrued

        def f(y: float) -> float:
            return self.price_from_yield(spec, y).dirty - target_dirty

        def df(y: float) -> float:
            coupon_anchor = spec.issue_date or spec.settlement
            Y_coupon = self._yf(coupon_anchor, spec.maturity, spec.day_count)
            redemption = spec.face * (1 + spec.coupon_rate * Y_coupon)
            Y_discount = self._yf(spec.settlement, spec.maturity, spec.day_count)
            denom = 1 + y * Y_discount
            return -redemption * Y_discount / (denom * denom)

        y_star = newton_raphson(f, df, x0=guess)
        return self.price_from_yield(spec, y_star)

    def cashflows(self, spec: BondSpec) -> list[Cashflow]:
        coupon_anchor = spec.issue_date or spec.settlement
        Y_coupon = self._yf(coupon_anchor, spec.maturity, spec.day_count)
        interest = spec.face * spec.coupon_rate * Y_coupon
        return [
            Cashflow(date=spec.maturity, amount=interest, type="interest"),
            Cashflow(date=spec.maturity, amount=spec.face, type="redemption"),
        ]
