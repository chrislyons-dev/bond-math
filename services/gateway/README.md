# Gateway Worker

**Version:** 2025.10 | **Service ID:** `gateway` | **Type:** Cloudflare Worker

Entry point and security gate for all API traffic in Bond Math.

---

## Responsibilities

1. **Authentication** - Verifies Auth0 OIDC tokens
2. **Authorization** - Mints internal JWTs with actor claims
3. **Routing** - Forwards to service bindings
4. **Security** - Rate limiting and security headers
5. **Observability** - Logging, timing, tracing

See: [Request Flow Design](../../docs/design/request-flow.md)

---

## Middleware Chain

Ordered execution:

1. **requestId** - Generate UUID for tracing
2. **securityHeaders** - Add X-Content-Type-Options, X-Frame-Options, etc.
3. **timing** - Track request duration
4. **logger** - Log requests/responses
5. **cors** - Handle CORS
6. **rateLimiter** - 100 req/min default

---

## Endpoints

### Health Check

```http
GET /health
```

```json
{
  "status": "healthy",
  "service": "gateway",
  "version": "2025.10"
}
```

### API Routes

```http
ALL /api/{service}/*
Authorization: Bearer {auth0-token}
```

**Routes:**
- `/api/daycount/*` → Day Count Worker
- `/api/valuation/*` → Valuation Worker
- `/api/metrics/*` → Metrics Worker
- `/api/pricing/*` → Pricing Worker

---

## Configuration

**Environment Variables:**

```toml
AUTH0_DOMAIN = "your-tenant.auth0.com"
AUTH0_AUDIENCE = "https://api.bondmath.chrislyons.dev"
INTERNAL_JWT_SECRET = "your-secret-min-32-bytes"
INTERNAL_JWT_TTL = "90"  # seconds
```

**Service Bindings:**

```toml
[[services]]
binding = "SVC_DAYCOUNT"
service = "daycount-worker"
# ... (see iac/workers/gateway.toml)
```

See: [Authentication Reference](../../docs/reference/authentication.md)

---

## Testing

### Via curl

```bash
# Health check
curl http://localhost:8787/health

# Day count calculation (requires Auth0 token)
curl -X POST http://localhost:8787/api/daycount/v1/count \
  -H "Authorization: Bearer ${AUTH0_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "pairs": [{"start": "2025-01-01", "end": "2025-07-01"}],
    "convention": "ACT_360"
  }'
```

### Development

```bash
npm install      # Install dependencies
npm test         # Run tests
npm run dev      # Start local server
npm run deploy   # Deploy to production
```

**Test Coverage:** 80% overall, 100% auth/middleware

---

## Related Documentation

- [Request Flow](../../docs/design/request-flow.md) - How requests flow through the system
- [Authentication Reference](../../docs/reference/authentication.md) - Setup and configuration
- [ADR-0006: Gateway Worker Design](../../docs/adr/0006-gateway-worker.md)
- [ADR-0011: Symmetric JWT](../../docs/adr/0011-symmetric-jwt-for-internal-auth.md)
- [Gateway Reference](../../docs/reference/gateway.md)
