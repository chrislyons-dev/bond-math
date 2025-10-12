# 🐍 Python: _Bond Valuation (Price/Yield)_

**Purpose:** Do **clean/dirty price ↔ yield** calculations and **generate
cashflow schedules** for standard bullet bonds.

**Role:** Stateless valuation microservice called by UI or other workers;
performs bond-math only (no market data or curve interpolation).

- **Inputs**
  - `settlementDate`, `maturity`, `couponRate`, `frequency`, `face`, `price`
    _or_ `yield`
  - `dayCountConvention` (delegates to Day-Count service), `eomRule`, stub flags

- **What it does**
  1. Constructs the full coupon schedule (handles EOM, business-day roll, and
     odd first/last periods when provided).
  2. Obtains accrual fractions from the Day-Count Worker (e.g., ACT_ACT_ICMA,
     30E_360).
  3. Computes:
     1. Yield → Price (discounts periodic coupons and redemption)
     2. Price → Yield (solves YTM iteratively)
     3. Accrued interest, clean/dirty price, and optional cashflow outputs.
  4. (Optionally) emits the **cashflows** so the pricing engine can discount
     them on a curve.

- **Outputs**
  - `cleanPrice`, `dirtyPrice`, `yield`, `accruedInterest`, `nextCoupon`,
    `cashflows[]` (optional)

- **When to call it**
  - You have quoted **price** or **yield** and want the other, plus standard
    bond cashflows/schedule.
  - Curve-free math tied to the instrument’s own YTM.

- **Examples**
  - **NOTE**: First and last coupon are optional.
    - They are needed for proper calculations when there is an odd first and/or
      last coupon period.
    - If first_coupon or last_coupon are omitted, the service attempts to infer
      a regular schedule by stepping backward from maturity using the stated
      frequency.
    - If this inference produces an inconsistent schedule (e.g., non-integral
      period count or negative date intervals), the service returns a 400 error
      indicating that explicit stub dates are required.

  ```json
  POST /api/valuation/v1/price
  {
    "settlementDate":"2025-07-01",
    "maturityDate":"2030-07-01",
    "couponRate":0.05,
    "frequency":2,
    "face":100,
    "yield":0.048,
    "dayCount":"ACT_ACT_ICMA",
    "eomRule":true,
    "firstCouponDate": "2025-12-31",
    "lastCouponDate": "2030-03-01"
  }
  ```

  ```json
  POST /api/valuation/v1/yield
  {
    "settlementDate":"2025-07-01",
    "maturityDate":"2030-07-01",
    "couponRate":0.05,
    "frequency":2,
    "face":100,
    "price":99.948,
    "dayCount":"ACT_ACT_ICMA",
    "eomRule":true,
    "firstCouponDate": "2025-12-31",
    "lastCouponDate": "2030-03-01"
  }
  ```
