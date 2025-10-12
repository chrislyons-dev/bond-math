# Bond Valuation Service

Price ↔ yield calculations and cashflow generation for bullet bonds.

**Version:** 2025.10 | **Type:** Cloudflare Python Worker | **Status:** Stub

## Purpose

Stateless bond valuation (no market data or curve interpolation):

1. Constructs coupon schedules (EOM, business-day roll, odd periods)
2. Obtains accrual fractions from Day-Count service
3. Calculates yield → price (NPV) or price → yield (YTM solver)
4. Returns accrued interest, clean/dirty price, cashflows

## API

### `POST /price`

Calculate price from yield.

**Gateway:** `POST /api/valuation/v1/price` | **Scope:** `valuation:write`

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
  "eomRule": true,
  "firstCouponDate": "2025-12-31",
  "lastCouponDate": "2030-03-01"
}
```

**Response (Stub):**

```json
{
  "cleanPrice": 99.948,
  "dirtyPrice": 100.573,
  "accruedInterest": 0.625,
  "nextCouponDate": "2025-12-31",
  "cashflows": [
    { "date": "2025-12-31", "amount": 2.5 },
    { "date": "2026-06-30", "amount": 2.5 },
    { "date": "2030-07-01", "amount": 102.5 }
  ],
  "version": "2025.10"
}
```

### `POST /yield`

Calculate yield from price.

**Gateway:** `POST /api/valuation/v1/yield` | **Scope:** `valuation:write`

**Request:**

```json
{
  "settlementDate": "2025-07-01",
  "maturityDate": "2030-07-01",
  "couponRate": 0.05,
  "frequency": 2,
  "face": 100,
  "price": 99.948,
  "dayCount": "ACT_ACT_ICMA",
  "eomRule": true
}
```

**Response (Stub):**

```json
{
  "yield": 0.048,
  "cleanPrice": 99.948,
  "dirtyPrice": 100.573,
  "accruedInterest": 0.625,
  "nextCouponDate": "2025-12-31",
  "version": "2025.10"
}
```

### `GET /health`

```json
{
  "status": "healthy",
  "service": "bond-valuation",
  "version": "2025.10"
}
```

## Status

**Stub implementation** - Returns hardcoded responses.

✅ Completed: Routes, validation, logging, security headers ⏳ Pending: Schedule
construction, NPV calculation, YTM solver, tests

## Development

```bash
pip install -e ../../libs/workers-py[dev]  # Install
pytest                                      # Test
mypy src && ruff check src                  # Lint
wrangler dev --config ../../iac/workers/valuation.toml  # Run local
```

## References

- [workers-py](../../libs/workers-py/README.md)
- [Bond Valuation Reference](../../docs/reference/bond-valuation.md)
- [ADR-0013: Logging](../../docs/adr/0013-structured-logging-standards.md)
