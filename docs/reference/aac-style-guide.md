# Architecture as Code (AAC) Style Guide

**Purpose:** Consistent AAC annotations enable automated diagram generation and
service discovery.

---

## Quick Start

VS Code snippets are available to generate AAC comments:

- **TypeScript Service**: Type `svcts` → Tab
- **Python Service**: Type `svcpy` → Tab
- **TypeScript Endpoint**: Type `epts` → Tab
- **Python Endpoint**: Type `eppy` → Tab
- **Data Model**: Type `model` → Tab
- **Middleware**: Type `mw` → Tab
- **Service Binding**: Type `bind` → Tab
- **Integration**: Type `int` → Tab
- **Error Handler**: Type `err` → Tab

---

## Service Module Annotations

### TypeScript

```typescript
/**
 * Day Count Service - Cloudflare Worker
 *
 * ACT/360, ACT/365F, 30/360, and other day count conventions.
 *
 * @service daycount
 * @type cloudflare-worker-typescript
 * @layer business-logic
 * @description Day count fraction calculations for bond math
 * @owner platform-team
 * @internal-routes /count, /health
 * @dependencies none
 * @security-model internal-jwt
 * @sla-tier high
 *
 * This service provides stateless calculations with no external dependencies.
 */
```

### Python

```python
"""Bond Valuation Service - Cloudflare Python Worker

Price ↔ yield calculations and cashflow schedule generation.

@service bond-valuation
@type cloudflare-worker-python
@layer business-logic
@description Price ↔ yield calculations and cashflow generation for bullet bonds
@owner platform-team
@internal-routes /price, /yield, /health
@dependencies svc-daycount
@security-model internal-jwt
@sla-tier high

This is a stub implementation that returns hardcoded responses to validate
the microapi framework integration.
"""
```

---

## Service-Level Tags

| Tag                | Required | Example                        | Description                      |
| ------------------ | -------- | ------------------------------ | -------------------------------- |
| `@service`         | ✅       | `daycount`                     | Service identifier (kebab-case)  |
| `@type`            | ✅       | `cloudflare-worker-typescript` | Runtime type                     |
| `@layer`           | ✅       | `business-logic`               | Architecture layer               |
| `@description`     | ✅       | `Day count calculations`       | One-line technical summary       |
| `@owner`           | ✅       | `platform-team`                | Owning team                      |
| `@internal-routes` | ✅       | `/count, /health`              | Internal endpoints               |
| `@dependencies`    | ✅       | `svc-daycount, svc-gateway`    | Service dependencies (or `none`) |
| `@security-model`  | ✅       | `internal-jwt`                 | Authentication model             |
| `@sla-tier`        | ✅       | `high`                         | SLA tier                         |

### Valid Values

**@type:**

- `cloudflare-worker-typescript`
- `cloudflare-worker-python`
- `cloudflare-worker-rust`
- `cloudflare-durable-object`

**@layer:**

- `gateway` - Entry point, routing, auth verification
- `business-logic` - Core domain logic
- `data-access` - Database/KV/R2 interactions

**@security-model:**

- `internal-jwt` - Internal service auth via Gateway-minted JWT
- `public-oauth2` - Public API with OAuth2 (Auth0)
- `none` - No authentication (health checks only)

**@sla-tier:**

- `critical` - 99.99% uptime, <50ms p95, on-call
- `high` - 99.9% uptime, <200ms p95
- `medium` - 99% uptime, <500ms p95
- `low` - Best effort

---

## Endpoint Annotations

### TypeScript

```typescript
/**
 * Calculate day count fraction between two dates
 *
 * @endpoint POST /count
 * @gateway-route POST /api/daycount/v1/count
 * @authentication internal-jwt
 * @scope daycount:write
 *
 * @param {CountRequest} request - Dates and convention
 * @returns {CountResponse} Day count fraction and days
 */
app.post('/count', requireScopes('daycount:write'), async (c) => {
  // Handler implementation
});
```

### Python

```python
@app.route("/price", methods=["POST"])
@require_scopes("valuation:write")
@validate_body({...})
async def calculate_price(request: Request) -> JsonResponse:
    """Calculate clean/dirty price from yield.

    This is a stub implementation returning hardcoded values.

    @endpoint POST /price
    @gateway-route POST /api/valuation/v1/price
    @authentication internal-jwt
    @scope valuation:write

    Args:
        request: HTTP request with bond parameters and yield

    Returns:
        Price calculation results
    """
```

### Endpoint Tags

| Tag               | Required | Example                       | Description            |
| ----------------- | -------- | ----------------------------- | ---------------------- |
| `@endpoint`       | ✅       | `POST /count`                 | Internal endpoint      |
| `@gateway-route`  | ✅       | `POST /api/daycount/v1/count` | External gateway route |
| `@authentication` | ✅       | `internal-jwt`                | Auth mechanism         |
| `@scope`          | ✅       | `daycount:write`              | Required OAuth2 scope  |

---

## Middleware Annotations

### TypeScript

```typescript
/**
 * JWT Authentication Middleware
 *
 * Verifies internal JWT tokens from Gateway and attaches actor claim.
 *
 * @middleware jwt-auth
 * @applies-to protected-routes
 * @order 20
 * @error-handling throw
 */
export const jwtAuth = async (c: Context, next: Next) => {
  // Implementation
};
```

### Middleware Tags

| Tag               | Example            | Description                          |
| ----------------- | ------------------ | ------------------------------------ |
| `@middleware`     | `jwt-auth`         | Middleware identifier                |
| `@applies-to`     | `protected-routes` | Route scope                          |
| `@order`          | `20`               | Execution order (10=first, 100=last) |
| `@error-handling` | `throw`            | Error strategy                       |

**@applies-to values:**

- `all-routes` - Runs on every request
- `protected-routes` - Only authenticated routes
- `public-routes` - Only public routes

**@error-handling values:**

- `throw` - Throws error (stops chain)
- `next` - Calls next() on error
- `log` - Logs and continues

---

## Data Model Annotations

### TypeScript

```typescript
/**
 * User session state
 *
 * @model SessionState
 * @persistence durable-object
 * @ttl 3600
 * @schema-version v1
 */
export interface SessionState {
  userId: string;
  expiresAt: number;
}
```

### Data Model Tags

| Tag               | Example          | Description                    |
| ----------------- | ---------------- | ------------------------------ |
| `@model`          | `SessionState`   | Model name                     |
| `@persistence`    | `durable-object` | Storage mechanism              |
| `@ttl`            | `3600`           | TTL in seconds (if applicable) |
| `@schema-version` | `v1`             | Schema version                 |

**@persistence values:**

- `none` - In-memory only
- `kv` - Cloudflare KV
- `durable-object` - Durable Objects
- `r2` - R2 object storage
- `d1` - D1 SQL database

---

## Service Binding Annotations

### TypeScript

```typescript
/**
 * Day Count Service Binding
 *
 * @binding DAYCOUNT_SERVICE
 * @target-service svc-daycount
 * @type service-binding
 * @timeout 30000
 */
const daycountService = env.DAYCOUNT_SERVICE;
```

---

## Best Practices

### ✅ Do

- Use kebab-case for service names (`bond-valuation`, not `BondValuation`)
- Keep `@description` to one line (under 80 chars)
- Always specify `@dependencies` (use `none` if no deps)
- Use consistent scope naming: `{service}:{action}` (e.g., `daycount:write`)
- Keep AAC comments at the **top** of the file/function
- Update AAC comments when architecture changes

### ❌ Don't

- Don't use AAC comments for implementation details (use regular comments)
- Don't duplicate information already in function signatures
- Don't create custom AAC tags (use standardized set)
- Don't skip required tags
- Don't use camelCase or PascalCase for service identifiers

---

## Validation

AAC annotations are validated in CI:

```bash
# Check for missing required tags
npm run lint:aac

# Verify service references exist
npm run validate:deps
```

---

## VS Code Setup

1. Install recommended extensions:

   ```bash
   code --install-extension dbaeumer.vscode-eslint
   code --install-extension ms-python.python
   ```

2. Snippets are automatically loaded from `.vscode/aac-snippets.code-snippets`

3. Use snippets:
   - Start typing a snippet prefix (e.g., `svc`, `ep`, `mw`) and press `Tab`
   - Press `Tab` to move between placeholder fields
   - All snippets: `svcts`, `svcpy`, `epts`, `eppy`, `model`, `mw`, `bind`,
     `int`, `err`

---

## Automated Diagram Generation

AAC annotations are parsed to generate architecture diagrams:

```bash
# Generate C4 diagrams from AAC annotations
npm run docs:diagrams
```

Output:

- `docs/diagrams/system-context.svg` - External systems view
- `docs/diagrams/container.svg` - Service-level view
- `docs/diagrams/component.svg` - Internal structure

---

## Examples

See real implementations:

- **TypeScript Service**:
  [services/daycount/src/index.ts](../../services/daycount/src/index.ts)
- **Python Service**:
  [services/bond-valuation/src/main.py](../../services/bond-valuation/src/main.py)
- **Gateway**:
  [services/gateway/src/index.ts](../../services/gateway/src/index.ts)

---

## Related Documentation

- **ADR-0001**: [Architecture as Code](../adr/0001-architecture-as-code.md)
- **ADR-0011**:
  [Internal JWT Authentication](../adr/0011-symmetric-jwt-for-internal-auth.md)
- **ADR-0012**:
  [Scope-Based Authorization](../adr/0012-scope-based-authorization.md)
