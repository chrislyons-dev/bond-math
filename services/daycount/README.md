# Day-Count Service

Authoritative day-count and year-fraction calculations for Bond Math.

## Overview

The Day-Count Worker is a Cloudflare Worker that provides deterministic, versioned calculations for all major day-count conventions used in fixed-income markets. It serves as the single source of truth for accrual calculations across all Bond Math services.

## Supported Conventions

| Convention | Code | Description | Typical Usage |
|------------|------|-------------|---------------|
| **ACT/360** | `ACT_360` | Actual days / 360 | U.S. money markets (T-bills, CP) |
| **ACT/365F** | `ACT_365F` | Actual days / 365 (fixed) | GBP/CAD money markets |
| **30/360 (Bond Basis)** | `30_360` | 30 days per month, 360 per year | U.S. corporate/municipal bonds |
| **30E/360 (Eurobond)** | `30E_360` | European 30/360 | Eurobonds, European corporates |
| **ACT/ACT ISDA** | `ACT_ACT_ISDA` | Actual/Actual (splits by year) | U.S. Treasuries, sovereigns |
| **ACT/ACT ICMA** | `ACT_ACT_ICMA` | Actual/Actual (coupon-based) | Semi-annual government bonds |

## API

**Note**: API versioning (`/v1/`) is handled at the Gateway level. This worker exposes unversioned endpoints that the Gateway routes to as `/api/daycount/v1/*`.

### `POST /count`

Calculates year fractions for one or more date pairs.

**Gateway Route**: `POST /api/daycount/v1/count`

**Request:**
```json
{
  "pairs": [
    {
      "start": "2025-01-31",
      "end": "2025-07-31"
    }
  ],
  "convention": "ACT_360",
  "options": {
    "eomRule": true,
    "frequency": 2
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "days": 181,
      "yearFraction": 0.5027777777777778,
      "basis": 360
    }
  ],
  "convention": "ACT_360",
  "version": "2025.10"
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "daycount",
  "version": "2025.10"
}
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Start local dev server
npm run dev
```

### Testing Locally

With the dev server running:

```bash
curl -X POST http://localhost:8787/count \
  -H "Content-Type: application/json" \
  -d '{
    "pairs": [{"start": "2025-01-01", "end": "2025-07-01"}],
    "convention": "ACT_360"
  }'
```

## Deployment

```bash
# Deploy to preview
npm run deploy:preview

# Deploy to production
npm run deploy
```

Or use the root `iac/Makefile`:

```bash
# From project root
cd iac
make wrangler-deploy-daycount

# Or start local dev
make wrangler-dev-daycount
```

## Architecture

### Service Metadata

- **Service**: `daycount`
- **Type**: `cloudflare-worker`
- **Layer**: `business-logic`
- **Framework**: Hono v4.x (HTTP routing)
- **Dependencies**: None (foundational service)
- **Called by**: `gateway`, `valuation`, `metrics`
- **Security**: Internal JWT (via service bindings)
- **Caching**: 1 hour (deterministic results)

### Key Design Decisions

See ADR-0007 for rationale on why day-count is a centralized microservice rather than a shared library.

**Benefits:**
- ✅ Single source of truth across Python, TypeScript, and Java services
- ✅ Versioned calculations (traceable results)
- ✅ Cacheable at the edge (fast, deterministic)
- ✅ Easy to test and validate independently

**Trade-offs:**
- Network overhead for internal calls (mitigated by service bindings)
- One more service to deploy (automated via CI/CD)

## File Structure

```
services/daycount/
├── src/
│   ├── index.ts           # Hono app with routes and middleware
│   ├── types.ts           # TypeScript interfaces
│   ├── validators.ts      # Request validation logic
│   ├── utils.ts           # Date parsing and utilities
│   └── conventions.ts     # Day-count implementations
├── test/
│   ├── utils.test.ts      # Utility function tests
│   ├── conventions.test.ts # Convention calculation tests
│   └── security.test.ts   # Security validation tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Technology Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript (strict mode)
- **Routing**: Hono v4.x (see ADR-0011)
- **Testing**: Vitest with 100% coverage
- **Validation**: Custom input validation with RFC 7807 errors
- **Middleware**: CORS (dev mode)

## Testing

### Unit Tests

All calculations have comprehensive unit tests:

```bash
npm test
```

**Coverage requirements:**
- Overall: 80%+
- Critical paths (calculations): 100%

### Test Cases

- ✅ Leap year handling
- ✅ Month-end boundary cases
- ✅ Multi-year periods
- ✅ Edge cases (same date, single day, etc.)
- ✅ Input validation
- ✅ Error handling

## Security

### Input Validation

The service implements defense-in-depth validation to prevent injection attacks:

- **Date Format Validation**: Strict regex `/^(\d{4})-(\d{2})-(\d{2})$/` enforces YYYY-MM-DD format
- **Convention Whitelist**: Only 6 pre-defined conventions accepted (ACT/360, ACT/365F, 30/360, 30E/360, ACT/ACT ISDA, ACT/ACT ICMA)
- **Type Validation**: All inputs validated for correct types (strings, numbers, booleans)
- **Range Validation**: Month (1-12), day (1-31), frequency (> 0)
- **DoS Prevention**: Maximum 1000 date pairs per request
- **No Code Execution**: All dates parsed to integers, no `eval()` or dynamic code execution

### SOLID Principles

- **Single Responsibility**: Each module has one clear purpose
- **Open/Closed**: Easy to extend with new conventions without modifying existing code
- **Liskov Substitution**: All conventions follow same interface
- **Interface Segregation**: Clean, focused TypeScript interfaces
- **Dependency Inversion**: Depends on abstractions, not concrete implementations

## Error Handling

All errors follow **RFC 7807 Problem Details** format:

```json
{
  "type": "https://bondmath.chrislyons.dev/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "One or more date pairs could not be calculated",
  "errors": [
    {
      "field": "pairs[0].start",
      "message": "Invalid date format: 2025/01/01. Expected YYYY-MM-DD"
    }
  ]
}
```

## Versioning

Each deployment includes a semantic version (`YYYY.MM`) for traceability:

```typescript
const VERSION = '2025.10';
```

Responses include the version in:
- `X-Service-Version` header
- `version` field in JSON response

## Related Documentation

- [API Reference](../../docs/reference/daycount.md)
- [ADR-0007: Centralized Day-Count Microservice](../../docs/adr/0007-centralized-day-count-microservice.md)
- [ADR-0011: HTTP Routing Framework Standards](../../docs/adr/0011-http-routing-framework-standards.md)
- [Code Documentation Standards](../../docs/code-documentation-standards.md)
- [Testing Standards](../../docs/testing-standards.md)
- [Hono Documentation](https://hono.dev/)

## Contributing

See [contributing.md](../../contributing.md) for commit standards and workflow.

**Commit scope:** `daycount`

```bash
feat(daycount): add support for BUS/252 convention
fix(daycount): correct ACT/ACT ICMA calculation for odd periods
test(daycount): add edge case tests for leap year boundaries
```
