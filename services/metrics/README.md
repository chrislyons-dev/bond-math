# Metrics Service

Duration, convexity, and risk metrics for bonds.

**Version:** 2025.10 | **Type:** Cloudflare Python Worker | **Status:** Stub

## Purpose

Risk metrics and sensitivity measures:

1. Uses Day-Count service for accrual calculations
2. Perturbs yield/price and re-prices to derive metrics
3. Calculates Macaulay/Modified/Effective duration, convexity, PV01/DV01
4. Optional key-rate duration support

### Rollout schedule

| **Phase**                    | **Metrics Implemented**                                                        | **Purpose / Value**                                                       |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **v1 – Core**                | Macaulay Duration, Modified Duration, Effective Duration, Convexity, PV01/DV01 | Core bond math foundation; clean, testable, supports all bullet bonds.    |
| **v2 – Risk / Trader**       | Key-Rate DV01, Spread Duration, Carry, Roll-Down                               | Enables full risk decomposition, curve & credit hedging, P&L forecasting. |
| **v3 – Portfolio Analytics** | Duration Contributions, Total Return, DTS, Breakeven Shift                     | Enables portfolio-level attribution, scenario, and performance analytics. |

|

### Definitions

| **Metric**                      | **Definition / Formula**                                                                                                        | **Interpretation**                                                               | **Typical Units**            | **When to Use**                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| **Macaulay Duration**           | Weighted average time to receive cashflows: [ Dₘ = \frac{\sum t_i \cdot PV_i}{\sum PV_i} ]                                      | Measures the _time-weighted center of mass_ of discounted cashflows.             | Years                        | Theoretical measure of interest-rate sensitivity. Rarely used directly for hedging. |
| **Modified Duration**           | Converts Macaulay Duration to yield sensitivity: [ D_{mod} = \frac{Dₘ}{1 + y/f} ] (where _y_ = YTM, _f_ = coupon frequency)     | Approximate % price change for a 1% change in yield: ΔP/P ≈ –Dₘₒd·Δy             | Years                        | Core risk metric for small parallel yield shifts (first-order).                     |
| **Effective Duration**          | Numerical (finite-difference) duration: [ D_{eff} = \frac{P_{-} - P_{+}}{2·P₀·Δy} ]                                             | Measures price sensitivity when cashflows may change (e.g., callable, floating). | Years                        | More accurate for irregular or option-embedded instruments.                         |
| **Convexity**                   | Second-order rate sensitivity: [ C = \frac{P_{-} + P_{+} - 2P₀}{P₀·(Δy)²} ]                                                     | Captures curvature of price/yield relationship; corrects duration error.         | Years²                       | Enhances accuracy for large yield changes (>50 bp).                                 |
| **PV01 / DV01**                 | Dollar value of 1 bp change in yield: [ PV01 = -\frac{ΔP}{Δy} \times 0.0001 ]                                                   | Change in bond’s price per 1 bp (0.01%) yield move.                              | Currency / per 1 bp          | Practical trader metric; used for hedging and scaling positions.                    |
| **Key-Rate DV01 (KR01)**        | DV01 computed for a single tenor node shift on the yield curve (others fixed).                                                  | Sensitivity to each maturity bucket (e.g., 2y, 5y, 10y).                         | Currency / per 1 bp per node | For curve risk and hedging portfolios with multiple maturities.                     |
| **Partial Duration**            | DV01 contribution from a subset of cashflows (e.g., by coupon or maturity).                                                     | Shows which periods drive overall duration.                                      | Currency / per 1 bp          | Analytical/debugging use or to visualize term-structure risk.                       |
| **Spread Duration**             | Sensitivity to changes in credit spread over benchmark curve: [ SD = -\frac{ΔP}{Δs} ]                                           | Measures credit-risk exposure independent of interest rates.                     | Currency / per 1 bp spread   | For corporate or sovereign spread risk management.                                  |
| **Yield Value of 1/32 (YV01)**  | Price change per 1/32nd point change in yield. [ YV01 = DV01 × (100/32) ]                                                       | Common quote unit in U.S. bond trading.                                          | Currency / 1/32 yield        | Trading convention for Treasury markets.                                            |
| **Carry**                       | Expected gain/loss over a horizon from coupon accrual + roll + funding: [ Carry ≈ Coupon·(t/T) - FundingCost + RollDownEffect ] | Reflects how much return is earned by simply holding the bond.                   | % or Currency                | Important for short-horizon return forecasting.                                     |
| **Roll-Down**                   | Price change from bond aging along an unchanged yield curve.                                                                    | Measures the “natural appreciation” as the bond moves down the curve.            | % or Currency                | Used with carry to forecast total return.                                           |
| **Accrued Interest Carry**      | Coupon interest earned until settlement or horizon date.                                                                        | Reflects earned income excluding price changes.                                  | Currency                     | For interim return calculations.                                                    |
| **Duration Contribution**       | Portion of total duration attributable to each cashflow or component.                                                           | Allows per-leg breakdown of risk exposure.                                       | Years or Currency / bp       | For visualization, portfolio risk decomposition.                                    |
| **Total Return (Horizon)**      | Expected holding-period return given yield, reinvestment, and carry assumptions.                                                | Combines yield, carry, roll, and price change.                                   | %                            | For scenario or performance simulations.                                            |
| **Duration Times Spread (DTS)** | Product of spread (bps) × spread duration.                                                                                      | Risk-weighted spread exposure metric for credit portfolios.                      | bp·Currency or %             | Standard in credit portfolio risk.                                                  |
| **Breakeven Rate Shift**        | Yield change that offsets carry and roll, producing zero total return.                                                          | Indicates tolerance before trade becomes unprofitable.                           | bp                           | For tactical yield-curve trades.                                                    |

## API

### `POST /duration`

**Gateway:** `POST /api/metrics/v1/duration` | **Scope:** `metrics:write`

**Request:**

```json
{
  "settlementDate": "2025-07-01",
  "maturityDate": "2030-07-01",
  "couponRate": 0.05,
  "frequency": 2,
  "face": 100,
  "yield": 0.048,
  "dayCount": "ACT_ACT_ICMA"
}
```

**Response (Stub):**

```json
{
  "macaulayDuration": 4.523,
  "modifiedDuration": 4.415,
  "convexity": 23.456,
  "pv01": 0.0441,
  "dv01": 44.15,
  "version": "2025.10"
}
```

### `POST /convexity`

**Gateway:** `POST /api/metrics/v1/convexity` | **Scope:** `metrics:write`

**Request:**

```json
{
  "settlementDate": "2025-07-01",
  "maturityDate": "2030-07-01",
  "couponRate": 0.05,
  "frequency": 2,
  "face": 100,
  "yield": 0.048,
  "dayCount": "ACT_ACT_ICMA"
}
```

**Response (Stub):**

```json
{
  "convexity": 23.456,
  "version": "2025.10"
}
```

### `POST /risk`

Comprehensive risk metrics with custom bump size.

**Gateway:** `POST /api/metrics/v1/risk` | **Scope:** `metrics:write`

**Request:**

```json
{
  "settlementDate": "2025-07-01",
  "maturityDate": "2030-07-01",
  "couponRate": 0.05,
  "frequency": 2,
  "face": 100,
  "yield": 0.048,
  "dayCount": "ACT_ACT_ICMA",
  "bumpBasisPoints": 1
}
```

**Response (Stub):**

```json
{
  "macaulayDuration": 4.523,
  "modifiedDuration": 4.415,
  "effectiveDuration": 4.42,
  "convexity": 23.456,
  "effectiveConvexity": 23.512,
  "pv01": 0.0441,
  "dv01": 44.15,
  "bumpBasisPoints": 1,
  "version": "2025.10"
}
```

### `GET /health`

```json
{
  "status": "healthy",
  "service": "metrics",
  "version": "2025.10"
}
```

## Status

**Stub implementation** - Returns hardcoded responses.

✅ Completed: Routes, validation, logging, security headers ⏳ Pending: Service
integration, duration/convexity calculations, tests

## Development

```bash
pip install -e ../../libs/workers-py[dev]  # Install
pytest                                      # Test
mypy src && ruff check src                  # Lint
wrangler dev --config ../../iac/workers/metrics.toml  # Run local
```

## References

- [workers-py](../../libs/workers-py/README.md)
- [Metrics Reference](../../docs/reference/metrics.md)
- [ADR-0013: Logging](../../docs/adr/0013-structured-logging-standards.md)
