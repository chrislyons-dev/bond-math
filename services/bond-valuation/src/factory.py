from __future__ import annotations

from .calculators.base import BondCalculator
from .calculators.discounted import DiscountedCalculator
from .calculators.iam import InterestAtMaturityCalculator
from .calculators.regular import RegularCouponCalculator
from .schedule.builder import ScheduleBuilder
from .types import BondType, DayCountFunc


class CalculatorFactory:
    def __init__(self, daycount: DayCountFunc, schedule_builder: ScheduleBuilder | None = None):
        self._dcf = daycount
        self._sched = schedule_builder or ScheduleBuilder()

    def get(self, bond_type: BondType) -> BondCalculator:
        if bond_type == BondType.DISCOUNTED:
            return DiscountedCalculator(self._dcf, self._sched)
        if bond_type == BondType.INTEREST_AT_MATURITY:
            return InterestAtMaturityCalculator(self._dcf, self._sched)
        if bond_type == BondType.REGULAR:
            return RegularCouponCalculator(self._dcf, self._sched)
        raise ValueError(f"Unsupported bond type: {bond_type}")
