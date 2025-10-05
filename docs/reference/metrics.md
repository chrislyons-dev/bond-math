# 🐍 Python: _Analytics (Bond Metrics)_

**Purpose:** Compute **duration**, **modified duration**, **convexity**, and
related measures.

- **Inputs**
  - Same instrument definition as valuation, plus optional bump sizes (e.g.,
    `bp=1e-4`)

- **What it does**
  - Uses Day-Count for accruals.
  - Perturbs yield/price and re-prices to derive **Macaulay/Modified duration**,
    **convexity**, **PV01**.
  - Can consume **cashflows** from valuation or rebuild schedule itself.

- **Outputs**
  - `macaulayDuration`, `modifiedDuration`, `convexity`, `pv01`, (optional)
    bucketed/key-rate metrics.

- **When to call it**
  - Risk/hedging, sensitivity reporting, or to compare bonds on a like-for-like
    basis.

### 🧰 Data contract tips

- Prefer passing **cashflows** from Valuation → Pricing so both sides agree on
  schedule and accrual.
- Echo the **day-count version** and **convention** in all outputs for
  auditability.
- Use **batching** (arrays) in each API to amortize overhead.
- Keep curve conventions (compounding, day count for the curve) **explicit** in
  pricing requests.
