# Day Count Service

**Version:** 2025.10 | **Service ID:** `daycount` | **Type:** Cloudflare Worker

Authoritative day-count and year-fraction calculations for fixed income.

---

## Supported Conventions

| Convention | Code | Typical Usage |
|------------|------|---------------|
| **ACT/360** | `ACT_360` | U.S. money markets (T-bills, CP) |
| **ACT/365F** | `ACT_365F` | GBP/CAD money markets |
| **30/360** | `30_360` | U.S. corporate/municipal bonds |
| **30E/360** | `30E_360` | Eurobonds |
| **ACT/ACT ISDA** | `ACT_ACT_ISDA` | U.S. Treasuries |
| **ACT/ACT ICMA** | `ACT_ACT_ICMA` | Semi-annual government bonds |

---

## API

### `POST /count`

**Gateway Route:** `POST /api/daycount/v1/count`
**Required Scope:** `daycount:write`

**Request:**
```json
{
  "pairs": [
    {"start": "2025-01-31", "end": "2025-07-31"}
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

```json
{
  "status": "healthy",
  "service": "daycount",
  "version": "2025.10"
}
```

---

## Testing

### Via curl

```bash
# Health check (no auth required)
curl http://localhost:8787/health

# Calculate day count (requires internal JWT from Gateway)
curl -X POST http://localhost:8787/count \
  -H "Authorization: Bearer ${INTERNAL_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "pairs": [{"start": "2025-01-31", "end": "2025-07-31"}],
    "convention": "ACT_360",
    "options": {"eomRule": true, "frequency": 2}
  }'

# Via Gateway (with Auth0 token)
curl -X POST http://localhost:8787/api/daycount/v1/count \
  -H "Authorization: Bearer ${AUTH0_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "pairs": [{"start": "2025-01-31", "end": "2025-07-31"}],
    "convention": "ACT_360"
  }'
```

### Development

```bash
npm install           # Install dependencies
npm test              # Run tests
npm run test:watch    # Watch mode
npm run dev           # Start local server
```

**Test Coverage:** 100% for conventions and utils

---

## Related Documentation

- [Request Flow](../../docs/design/request-flow.md) - How requests flow through the system
- [Day Count Reference](../../docs/reference/daycount.md) - Convention details
- [Authorization Model](../../docs/design/authorization-model.md) - Scopes and roles
