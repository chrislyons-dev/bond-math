from __future__ import annotations

from datetime import date

from dateutil.relativedelta import relativedelta

from ..types import BondSpec


class ScheduleBuilder:
    """Build coupon dates with long/short first/last support via anchors.

    This is intentionally minimal. Swap with a robust engine later (EOM, biz days).
    """

    def build(self, spec: BondSpec) -> list[date]:
        if spec.frequency.value <= 0:
            return [spec.maturity]

        months = 12 // spec.frequency.value
        dates: list[date] = [spec.maturity]
        d = spec.maturity

        stop_line = spec.issue_date or spec.settlement

        while True:
            d = d - relativedelta(months=months)
            if d <= stop_line:
                break
            dates.append(d)

        if spec.first_coupon and spec.first_coupon not in dates:
            dates.append(spec.first_coupon)
        if spec.last_coupon and spec.last_coupon not in dates:
            dates.append(spec.last_coupon)

        dates = sorted(dates)
        return dates
