# Service Selection Guide

**When to use which Bond Math service for your calculations**

This guide helps you choose the right service endpoint based on your calculation
needs.

---

## Overview

Bond Math separates **cashflow valuation** from **bond math & metrics** so each
piece can be simple, testable, and replaceable.

Each service has a specific responsibility:

- **Day-Count** (TypeScript): Authoritative accrual calculations
- **Valuation** (Python): Bond-specific math (yield ↔ price, accrued interest)
- **Pricing** (Java): Curve-based cashflow discounting
- **Analytics** (Python): Risk metrics (duration, convexity, PV01)

---

## How They Fit Together

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Valuation (Python)                                      │
│     Input:  Bond terms + (price OR yield)                   │
│     Output: Schedule, accrued, clean/dirty, cashflows       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ cashflows[]
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Pricing Engine (Java)                                   │
│     Input:  Cashflows + market discount curve               │
│     Output: PV (by leg, total), sensitivities               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  3. Analytics (Python)                                      │
│     Input:  Bond terms + valuation inputs                   │
│     Output: Duration, convexity, PV01                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Day-Count (TypeScript) - Used by ALL services              │
│     Ensures identical accrual fractions everywhere          │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Selection Matrix

| Need                                    | Call                                        | Why                                                        |
| --------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Convert **yield ↔ price**              | `POST /api/valuation/v1/calculate` (Python) | Instrument math tied to YTM; curve not required            |
| Get **accrued interest**                | `POST /api/valuation/v1/calculate` (Python) | Bond-specific accrual logic                                |
| Generate **coupon schedule**            | `POST /api/valuation/v1/calculate` (Python) | Coupon payment dates and amounts                           |
| Compute **duration/convexity/PV01**     | `POST /api/analytics/v1/calculate` (Python) | Sensitivities via re-pricing and/or closed forms           |
| Value **cashflows on a curve**          | `POST /api/pricing/v1/value` (Java)         | Curve-based PV, scenario/what-if, KR01, audit trail of DFs |
| Calculate **day count** between dates   | `POST /api/daycount/v1/count` (TypeScript)  | Single source of truth for all accrual calculations        |
| **Scenario analysis** with curve shifts | `POST /api/pricing/v1/value` (Java)         | Stress testing, parallel shifts, key rate shocks           |
| **Cross-currency** PV                   | `POST /api/pricing/v1/value` (Java)         | FX conversion and multi-currency discounting               |
