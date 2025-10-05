# ☕ Java: _Pricing Engine_ — “Discounting engine for projected cashflows”

**Purpose:** Take a **set of dated cashflows** and a **discount curve** and
return **present value (PV)** results.

- **Inputs**
  - `asOf`: valuation date
  - `cashflows[]`: `{ date, amount, currency }`
  - `discountCurve`: bootstrapped/parametric curve or a set of zero/discount
    factors (e.g., `{ tenor, rate }` or `{ date, df }`)
  - (optional) `fx` for cross-currency PV, `compounding`/`dayCount` for curve
    conventions

- **Price**
  1. Aligns each cashflow with curve points (interpolates/extrapolates as
     needed).
  2. Computes discount factors from curve conventions.
  3. Sums **PV = Σ (cashflow × DF)**.
  4. Returns PV by leg, currency, and total; can also return **sensitivities**
     (key-rate PV01) if requested.

- **Outputs**
  - `pvTotal`, `pvByLeg`, (optional) `keyRatePV`, `dfAtNodes`, audit **trace**
    of curve/DF usage.

- **When to call it**
  - You already have a schedule + amounts (e.g., from the Python pricer) and
    need **valuation under a given curve**.
  - You want curve-driven results (scenario/what-if, stress testing, key rates).

- **Example (sketch)**

  ```json
  POST /api/pricing/v1/value
  {
    "asOf": "2025-07-01",
    "cashflows": [
      {"date":"2026-01-01","amount":25.00,"currency":"USD"},
      {"date":"2026-07-01","amount":25.00,"currency":"USD"},
      {"date":"2030-07-01","amount":1025.00,"currency":"USD"}
    ],
    "discountCurve": {
      "convention":"ACT_365F",
      "compounding":"Continuous",
      "nodes":[
        {"date":"2025-07-01","zeroRate":0.042},
        {"date":"2026-07-01","zeroRate":0.044},
        {"date":"2030-07-01","zeroRate":0.047}
      ]
    }
  }
  ```
