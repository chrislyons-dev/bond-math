# ADR-0010: HTTP Routing Framework Standards

**Status:** Accepted **Date:** 2025-10-05 **Context:** ADR-0002 (Multi-Language
Services), ADR-0006 (Gateway Worker)

---

## Context

Bond Math is a multi-language microservices architecture with services in
TypeScript (Cloudflare Workers), Python (AWS Lambda), and Java (AWS Lambda).
Each service exposes HTTP APIs requiring routing, middleware, error handling,
type safety, and service bindings.

We need consistent routing patterns across languages while respecting ecosystem
best practices.

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

### Python (AWS Lambda): **FastAPI** (v0.109+)

**Rationale:**

- Industry standard Python API framework
- Type safety via Pydantic (automatic request/response validation)
- OpenAPI/Swagger auto-generation (critical for API documentation)
- Native async/await for high-performance I/O
- Dependency injection for clean middleware patterns
- Seamless AWS Lambda integration via Mangum adapter

**Alternatives considered:** Flask (too minimal), Django REST (too heavy),
Starlette (FastAPI built on it), Chalice (AWS lock-in)

### Java (AWS Lambda): **Spring Boot** (v3.2+) with Spring Cloud Function

**Rationale:**

- Enterprise standard with mature ecosystem
- Strong compile-time type checking
- Spring IoC container for dependency injection
- Spring Cloud Function provides AWS Lambda adapter
- JSR-303/Hibernate Validator for declarative validation
- Built-in metrics, tracing (Micrometer, Actuator)
- Comprehensive test framework (MockMvc, @WebMvcTest)

**Alternatives considered:** Quarkus (worth considering for cold-start
optimization), Micronaut (worth considering for memory limits), Vert.x (too
low-level), Dropwizard (less momentum)

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

- Consistency across all services despite different languages
- Developer velocity via best-in-class frameworks per ecosystem
- Type safety with compile-time checking
- Well-documented, community-supported frameworks
- Excellent test support and observability built-in
- Gateway middleware chains enable complex routing
- Auto-generated API documentation (FastAPI, Spring Boot)

**Negative:**

- +1 dependency per service (mitigated by stability/maturity)
- Team needs familiarity with 3 frameworks
- Slightly less control than custom routing
- Need to track framework breaking changes

---

## Related Documentation

- **Implementation Details:**
  [Routing Standards Reference](../reference/routing-standards.md)
- **Related ADRs:** ADR-0002 (Multi-Language), ADR-0006 (Gateway Worker),
  ADR-0001 (Architecture as Code)

---

## References

- [Hono Documentation](https://hono.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [RFC 7807: Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
