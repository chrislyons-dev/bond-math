# Pricing Service

Curve-based cashflow discounting for present value calculations.

**Version:** 2025.10 | **Type:** Cloudflare Python Worker | **Status:** Stub

## Purpose

Discounting engine for cashflow valuation:

1. Accepts dated cashflows and discount curve
2. Interpolates/extrapolates curve to cashflow dates
3. Calculates discount factors and present value
4. Supports scenario analysis and key-rate sensitivities

## API

### `POST /value`

Calculate present value from cashflows and curve.

**Gateway:** `POST /api/pricing/v1/value` | **Scope:** `pricing:write`

**Request:**

```json
{
  "asOf": "2025-07-01",
  "cashflows": [
    { "date": "2026-01-01", "amount": 25.0, "currency": "USD" },
    { "date": "2026-07-01", "amount": 25.0, "currency": "USD" },
    { "date": "2030-07-01", "amount": 1025.0, "currency": "USD" }
  ],
  "discountCurve": {
    "convention": "ACT_365F",
    "compounding": "Continuous",
    "nodes": [
      { "date": "2025-07-01", "zeroRate": 0.042 },
      { "date": "2026-07-01", "zeroRate": 0.044 },
      { "date": "2030-07-01", "zeroRate": 0.047 }
    ]
  },
  "currency": "USD"
}
```

**Response (Stub):**

```json
{
  "pvTotal": 1025.47,
  "pvByLeg": [{ "leg": "fixed", "pv": 1025.47 }],
  "discountFactors": [
    { "date": "2026-01-01", "df": 0.9801 },
    { "date": "2026-07-01", "df": 0.9608 },
    { "date": "2030-07-01", "df": 0.8187 }
  ],
  "currency": "USD",
  "asOf": "2025-07-01",
  "version": "2025.10"
}
```

### `POST /scenario`

Calculate PV under multiple curve scenarios.

**Gateway:** `POST /api/pricing/v1/scenario` | **Scope:** `pricing:write`

**Request:**

```json
{
  "asOf": "2025-07-01",
  "cashflows": [...],
  "discountCurve": {...},
  "scenarios": [
    {"name": "base", "shift": 0},
    {"name": "up_50bp", "shift": 50},
    {"name": "down_50bp", "shift": -50}
  ]
}
```

**Response (Stub):**

```json
{
  "scenarios": [
    { "name": "base", "pvTotal": 1025.47, "shift": 0 },
    { "name": "up_50bp", "pvTotal": 1015.32, "shift": 50 },
    { "name": "down_50bp", "pvTotal": 1035.89, "shift": -50 }
  ],
  "asOf": "2025-07-01",
  "version": "2025.10"
}
```

### `POST /key-rate`

Calculate key rate PV01 sensitivities.

**Gateway:** `POST /api/pricing/v1/key-rate` | **Scope:** `pricing:write`

**Request:**

```json
{
  "asOf": "2025-07-01",
  "cashflows": [...],
  "discountCurve": {...},
  "bumpBasisPoints": 1
}
```

**Response (Stub):**

```json
{
  "pvTotal": 1025.47,
  "keyRates": [
    { "tenor": "1Y", "pv01": 0.15 },
    { "tenor": "2Y", "pv01": 0.28 },
    { "tenor": "5Y", "pv01": 0.52 },
    { "tenor": "10Y", "pv01": 0.31 }
  ],
  "totalPV01": 1.26,
  "bumpBasisPoints": 1,
  "version": "2025.10"
}
```

### `GET /health`

```json
{
  "status": "healthy",
  "service": "pricing",
  "version": "2025.10"
}
```

## Status

**Stub implementation** - Returns hardcoded responses.

 Completed: Routes, validation, logging, security headers � Pending: Curve
interpolation, discount factor calculation, PV computation, tests

## Development

```bash
pip install -e ../../libs/microapi[dev]  # Install
pytest                                    # Test
mypy src && ruff check src                # Lint
wrangler dev --config ../../iac/workers/pricing.toml  # Run local
```

## References

- [microapi](../../libs/microapi/README.md)
- [Pricing Reference](../../docs/reference/pricing.md)
- [ADR-0013: Logging](../../docs/adr/0013-structured-logging-standards.md)
