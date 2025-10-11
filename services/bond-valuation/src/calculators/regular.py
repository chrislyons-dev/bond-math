from __future__ import annotations

from ..types import BondSpec, Cashflow, PricingResult
from .base import BondCalculator, newton_raphson


class RegularCouponCalculator(BondCalculator):
    def price_from_yield(self, spec: BondSpec, ytm: float) -> PricingResult:
        m = spec.frequency.value
        schedule = self._sched.build(spec)
        accrued = super().accrued_interest(spec)

        dirty = 0.0
        for dt in schedule:
            if dt <= spec.settlement:
                continue
            yf = self._yf(spec.settlement, dt, spec.day_count)
            t = m * yf
            cf = spec.face * spec.coupon_rate / m
            if dt == schedule[-1]:
                cf += spec.face
            dirty += cf / (1 + ytm / m) ** t

        return PricingResult(clean=dirty - accrued, dirty=dirty, accrued=accrued, ytm=ytm)

    def yield_from_price(
        self, spec: BondSpec, clean_price: float, guess: float = 0.05
    ) -> PricingResult:
        accrued = super().accrued_interest(spec)
        target_dirty = clean_price + accrued
        m = spec.frequency.value
        schedule = self._sched.build(spec)

        def price_y(y: float) -> float:
            total = 0.0
            for dt in schedule:
                if dt <= spec.settlement:
                    continue
                yf = self._yf(spec.settlement, dt, spec.day_count)
                t = m * yf
                cf = spec.face * spec.coupon_rate / m
                if dt == schedule[-1]:
                    cf += spec.face
                total += cf / (1 + y / m) ** t
            return total

        def f(y: float) -> float:
            return price_y(y) - target_dirty

        def df(y: float) -> float:
            eps = max(1e-7, abs(y) * 1e-5)
            return (f(y + eps) - f(y - eps)) / (2 * eps)

        y_star = newton_raphson(f, df, x0=guess)
        return self.price_from_yield(spec, y_star)

    def cashflows(self, spec: BondSpec) -> list[Cashflow]:
        m = spec.frequency.value
        schedule = self._sched.build(spec)
        flows: list[Cashflow] = []
        for dt in schedule:
            coupon_amt = spec.face * spec.coupon_rate / m
            flows.append(Cashflow(date=dt, amount=coupon_amt, type="coupon"))
            if dt == schedule[-1]:
                flows.append(Cashflow(date=dt, amount=spec.face, type="redemption"))
        return sorted(flows, key=lambda c: c.date)
