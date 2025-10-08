# Architecture as Code (AAC) Style Guide

**Purpose:** Consistent AAC annotations drive automated C4 diagram generation,
architecture documentation, and service discovery via Structurizr DSL.

**Pipeline:** Code + IAC → IR (JSON) → Structurizr DSL → PlantUML → PNG/SVG +
Docs

**Run:** `npm run docs:arch` to generate all artifacts in `/docs/architecture`

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

- `ui` - User interface (Astro Pages, React/Vue/Svelte)
- `api-gateway` - Entry point, routing, auth verification
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
 * @service-binding SVC_DAYCOUNT
 * @target daycount
 * @purpose Calculate year fractions and accrual days
 */
const daycountService = env.SVC_DAYCOUNT;
```

---

## Class Diagram Control

Use `@exclude-from-diagram` to prevent classes from appearing in generated
component diagrams. This keeps diagrams focused on architectural components
rather than implementation details.

### TypeScript

```typescript
/**
 * Simple DTO for bond details
 * @exclude-from-diagram
 */
class BondDetailsDTO {
  couponRate: number;
  maturity: Date;
}
```

### Python

```python
"""Utility helper for date calculations.

@exclude-from-diagram
"""
class DateUtils:
    @staticmethod
    def add_business_days(start: date, days: int) -> date:
        # Implementation
```

### When to Exclude

- DTOs/POJOs with no business logic
- Simple utility classes
- Generated code (e.g., from OpenAPI/Protobuf)
- Framework boilerplate
- Value objects with only getters/setters

**Default:** All classes are included in diagrams unless explicitly marked
`@exclude-from-diagram`

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

AAC annotations are validated during the docs generation pipeline:

```bash
# Full pipeline (extract → validate → generate → render)
npm run docs:arch

# Just extraction (to IR JSON)
npm run docs:arch:extract

# Just validation (JSON Schema + dependency rules)
npm run docs:arch:validate

# Just rendering (PlantUML → PNG/SVG)
npm run docs:arch:render
```

**CI checks:**

- IR conforms to JSON Schema (`schemas/aac-ir.json`)
- All service references resolve (no broken dependencies)
- No circular dependencies
- Structurizr DSL generation succeeds
- Diagrams are in sync with code (fails if stale)

**Dependency validation:**

- TypeScript: `dependency-cruiser` enforces architectural rules
- Python: `import-linter` enforces layering

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

AAC annotations are extracted and processed through a Structurizr DSL pipeline:

```bash
# Generate all C4 diagrams and documentation
npm run docs:arch
```

**What gets generated:**

**C4 Diagrams:**

- System Context (external dependencies: Auth0, users, Cloudflare)
- Container (all Workers, Pages)
- Component (per-service class diagrams)
- Deployment (per environment: dev/staging/prod with Workers, KV, R2, routes)

**Documentation:**

- Service inventory with tech stacks
- Per-service documentation (endpoints, config, dependencies, deployment)
- Infrastructure topology (routes, bindings, custom domains)

**Output structure:**

```
docs/architecture/
├── workspace.dsl              # Structurizr DSL
├── ir.json                    # Validated intermediate representation
├── diagrams/
│   ├── system-context.{puml,png,svg}
│   ├── container.{puml,png,svg}
│   ├── components/*.{puml,png}
│   └── deployment/{dev,staging,production}.{puml,png}
└── docs/
    ├── index.md               # Architecture overview
    ├── services.md            # Service inventory
    └── components/*.md        # Per-service docs
```

**Extractors:**

- TypeScript: `ts-morph` (JSDoc, imports, decorators)
- Python: `libcst` (docstrings, decorators, imports)
- Wrangler: `@iarna/toml` (service bindings, routes, KV/R2)
- Terraform: `hcl2-parser` (infrastructure, DNS, deployment)

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
