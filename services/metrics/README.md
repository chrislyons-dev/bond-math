# Metrics Service

Duration, convexity, and risk metrics for bonds.

**Version:** 2025.10 | **Type:** Cloudflare Python Worker | **Status:** Stub

## Purpose

Risk metrics and sensitivity measures:

1. Uses Day-Count service for accrual calculations
2. Perturbs yield/price and re-prices to derive metrics
3. Calculates Macaulay/Modified/Effective duration, convexity, PV01/DV01
4. Optional key-rate duration support

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
