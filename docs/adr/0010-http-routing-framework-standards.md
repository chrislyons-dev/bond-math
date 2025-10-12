# ADR-0010: HTTP Routing Framework Standards

**Status:** Accepted **Date:** 2025-10-05 **Context:** ADR-0002 (Multi-Language
Services), ADR-0006 (Gateway Worker)

---

## Context

Bond Math is a multi-language microservices architecture with services in
TypeScript and Python on Cloudflare Workers. Each service exposes HTTP APIs
requiring routing, middleware, error handling, type safety, and service
bindings.

We need consistent routing patterns across languages while respecting ecosystem
best practices and Cloudflare Workers runtime constraints.

---

## Decision

We will adopt the following HTTP routing frameworks:

### TypeScript (Cloudflare Workers): **Hono** (v4.x)

**Rationale:**

- Built for Cloudflare Workers (native Service Bindings, KV, Durable Objects)
- Middleware-first design (essential for Gateway auth, logging, rate limiting)
- Lightweight (~12KB, edge-optimized)
- Type-safe with generic contexts
- Wildcard routing for Gateway proxy patterns (`/api/daycount/v1/*`)
- Battle-tested by major Cloudflare projects

**Alternatives considered:** itty-router (too minimal), Worktop (ecosystem
concerns), sunder (not CF-optimized), custom router (maintenance burden)

### Python (Cloudflare Workers): **flarelette** (custom microframework)

**Rationale:**

- Cloudflare Workers Python runtime constraints (Pyodide, <1MB bundle, no C
  extensions)
- FastAPI too heavy (~800KB) with incompatible pydantic C extensions
- Custom framework modeled after Hono for consistency
- Lightweight (~15KB), async-native, pure Python
- Decorator-based routing with middleware chain
- Built-in JWT auth, validation, structured logging
- See ADR-0014 for detailed rationale

**Alternatives considered:** FastAPI (too heavy), Flask (WSGI-based), Starlette
(requires ASGI server), Quart (too heavy), Falcon (WSGI-based)

---

## Consistency Patterns

Despite different frameworks, we enforce consistency through:

1. **Route Structure** - All services: `POST /[operation]`, `GET /health`,
   Gateway: `/api/{service}/v1/*`
2. **Error Responses** - RFC 7807 Problem Details format across all services
3. **Health Checks** - Standardized
   `{"status": "healthy", "service": "...", "version": "..."}`
4. **Architecture as Code** - Consistent annotations in JSDoc/Docstrings/Javadoc
5. **Request/Response Validation** - Type-safe models with automatic validation
6. **Middleware Order** - Logging → CORS → Auth → Authorization → Rate Limit →
   Handler → Error Normalization

---

## Consequences

**Positive:**

- Consistency across TypeScript/Python Workers (Hono-like patterns)
- Developer velocity via battle-tested Hono and custom flarelette
- Type safety with type hints (Python) and TypeScript
- Excellent test support and observability built-in
- Gateway middleware chains enable complex routing
- flarelette optimized for Cloudflare Workers constraints

**Negative:**

- flarelette requires maintenance (custom framework)
- Team needs familiarity with both Hono and flarelette
- flarelette less feature-rich than FastAPI
- Need to track Hono breaking changes

---

## Related Documentation

- **Implementation Details:**
  [Routing Standards Reference](../reference/routing-standards.md)
- **Related ADRs:** ADR-0002 (Multi-Language), ADR-0006 (Gateway Worker),
  ADR-0001 (Architecture as Code), ADR-0014 (Python Workers Framework)

---

## References

- [Hono Documentation](https://hono.dev/)
- [flarelette Library](../../libs/flarelette)
- [Cloudflare Python Workers](https://developers.cloudflare.com/workers/languages/python/)
- [RFC 7807: Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
