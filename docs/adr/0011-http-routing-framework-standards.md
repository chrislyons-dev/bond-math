# ADR-0011: HTTP Routing Framework Standards

**Date**: 2025-10-05 **Status**: Proposed **Context**: ADR-0002 (Multi-Language
Services), ADR-0006 (Gateway Worker) **Affects**: All HTTP-exposed services
(Gateway, Day-Count, Valuation, Pricing, Metrics)

---

## Context

Bond Math is a multi-language microservices architecture with services written
in TypeScript (Cloudflare Workers), Python (FastAPI/AWS Lambda), and Java
(Spring Boot/AWS Lambda). Each service exposes HTTP APIs that require:

- **Routing**: Map HTTP methods and paths to handlers
- **Middleware**: Authentication, authorization, logging, rate limiting, CORS
- **Error handling**: Consistent RFC 7807 Problem Details responses
- **Type safety**: Request/response validation
- **Service bindings**: Worker-to-worker communication (Cloudflare)
- **API versioning**: `/v1/`, `/v2/` support at Gateway level

We need to establish consistent routing patterns across all languages while
respecting each ecosystem's best practices.

### Current State

- **Gateway Worker**: Not yet implemented (will route to all services)
- **Day-Count Worker**: Custom 30-line routing table with regex patterns
- **Valuation Service**: Not yet implemented (planned Python/FastAPI)
- **Pricing Service**: Not yet implemented (planned Java/Spring Boot)
- **Metrics Service**: Not yet implemented (planned Python/FastAPI)

### Key Requirements

**Gateway-specific needs:**

1. Complex routing to multiple downstream services
2. Middleware chains (auth → authorization → rate limit → logging)
3. Service binding integration (Cloudflare Workers)
4. Wildcard routing (`/api/daycount/v1/*` → daycount worker)
5. Context passing (user info from JWT to downstream services)
6. API versioning logic (`/v1/` vs `/v2/`)

**Microservice needs:**

1. Simple, focused routing (2-5 endpoints typical)
2. Type-safe request/response handling
3. Minimal boilerplate
4. Consistent error handling
5. Health check endpoints
6. Architecture as Code (AAC) metadata extraction

### Evaluation Criteria

1. **Ecosystem fit**: Does it align with language/platform conventions?
2. **Developer ergonomics**: How much boilerplate is required?
3. **Type safety**: Compile-time request/response validation?
4. **Middleware support**: Composable cross-cutting concerns?
5. **Performance**: Request handling overhead
6. **Community adoption**: Stability, documentation, maintenance
7. **Consistency**: Can we establish patterns across languages?
8. **Learning curve**: Time to proficiency for team members

---

## Decision

We will adopt the following HTTP routing frameworks:

### TypeScript (Cloudflare Workers)

**Framework**: **Hono** (v4.x)

**Rationale**:

- **Built for Cloudflare Workers**: Native support for Service Bindings, Durable
  Objects, KV
- **Middleware-first design**: Essential for Gateway (auth, logging, rate
  limiting)
- **Lightweight**: ~12KB, optimized for edge runtime
- **Type-safe**: Full TypeScript support with generic contexts
- **Wildcard routing**: Critical for Gateway proxy patterns
  (`/api/daycount/v1/*`)
- **Context passing**: Easy to attach user info from JWT for downstream services
- **Battle-tested**: Used by major Cloudflare projects (Cloudflare Pages, etc.)
- **Consistent patterns**: Similar to Express.js (familiar to JS/TS developers)

**Alternatives considered**:

| Framework         | Pros                            | Cons                                            | Verdict                         |
| ----------------- | ------------------------------- | ----------------------------------------------- | ------------------------------- |
| **itty-router**   | Tiny (450 bytes), minimal       | No built-in middleware, manual context passing  | ❌ Too minimal for Gateway      |
| **Worktop**       | Full-featured, CF-native        | Less active maintenance, smaller community      | ❌ Ecosystem concerns           |
| **sunder**        | Express-like API                | Heavier, less CF-specific                       | ❌ Not optimized for Workers    |
| **Custom router** | Zero dependencies, full control | Reinventing middleware, context, error handling | ❌ Not worth maintenance burden |

**Example (Gateway)**:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

type Bindings = {
  DAYCOUNT: Fetcher;
  VALUATION: Fetcher;
  PRICING: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware chain
app.use('*', logger());
app.use('*', cors());
app.use('/api/*', authenticate());

// Proxy to daycount worker (all endpoints)
app.all('/api/daycount/v1/*', async (c) => {
  const path = c.req.path.replace('/api/daycount/v1', '');
  return c.env.DAYCOUNT.fetch(new Request(`http://daycount${path}`, c.req.raw));
});

// Direct routing with authorization
app.post('/api/pricing/v1/bond', authorize('pricing:write'), async (c) => {
  const user = c.get('user');
  return c.env.PRICING.fetch(c.req.raw);
});

export default app;
```

**Example (Day-Count Worker)**:

```typescript
import { Hono } from 'hono';

const app = new Hono();

app.post('/count', async (c) => {
  const body = await c.req.json<DayCountRequest>();
  // Validation and calculation logic
  return c.json(response);
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy', version: VERSION });
});

export default app;
```

---

### Python (AWS Lambda / FastAPI)

**Framework**: **FastAPI** (v0.109+)

**Rationale**:

- **Industry standard**: De facto Python web framework for APIs
- **Type safety via Pydantic**: Automatic request/response validation
- **OpenAPI/Swagger**: Auto-generated API documentation (critical for consumers)
- **Async/await**: Native async support for high-performance I/O
- **Dependency injection**: Clean middleware pattern for auth, DB connections
- **Validation**: Built-in request validation with detailed error messages
- **AWS Lambda integration**: Works seamlessly with Mangum adapter
- **Ecosystem**: Massive community, extensive middleware, well-documented

**Alternatives considered**:

| Framework                 | Pros                    | Cons                                           | Verdict                              |
| ------------------------- | ----------------------- | ---------------------------------------------- | ------------------------------------ |
| **Flask**                 | Simple, minimal         | No built-in validation, async support limited  | ❌ Too minimal for production        |
| **Django REST Framework** | Full-featured, admin UI | Heavy, opinionated, overkill for microservices | ❌ Too heavy                         |
| **Starlette**             | Lightweight, async      | Less built-in validation than FastAPI          | ❌ FastAPI built on Starlette anyway |
| **Chalice**               | AWS-native, simple      | Limited community, AWS lock-in                 | ❌ Prefer standard frameworks        |

**Example (Valuation Service)**:

```python
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Bond Valuation Service", version="2025.10")

class BondValuationRequest(BaseModel):
    bond_id: str
    settlement_date: str
    yield_curve: List[float]

class BondValuationResponse(BaseModel):
    clean_price: float
    dirty_price: float
    accrued_interest: float

@app.post("/value", response_model=BondValuationResponse)
async def value_bond(
    request: BondValuationRequest,
    user: User = Depends(get_current_user)
):
    """
    @endpoint POST /value
    @gateway-route POST /api/valuation/v1/value
    @authentication internal-jwt
    @scope valuation:read
    """
    # Validation happens automatically via Pydantic
    result = await calculate_valuation(request)
    return result

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "valuation"}

# AWS Lambda handler
from mangum import Mangum
handler = Mangum(app)
```

**Benefits**:

- **Automatic validation**: Pydantic models catch errors before handler logic
- **OpenAPI spec**: Gateway can fetch and aggregate schemas
- **Type hints**: Full IDE support, static type checking with mypy
- **Middleware**: Easy to add auth, logging, tracing (Starlette middleware)
- **Testing**: Built-in TestClient for integration tests

---

### Java (AWS Lambda / Spring Boot)

**Framework**: **Spring Boot** (v3.2+) with **Spring Cloud Function**

**Rationale**:

- **Enterprise standard**: Java ecosystem's most mature web framework
- **Type safety**: Strong compile-time type checking
- **Dependency injection**: Spring's IoC container for clean architecture
- **AWS Lambda integration**: Spring Cloud Function provides seamless adapter
- **Validation**: JSR-303/Hibernate Validator for declarative validation
- **Ecosystem**: Massive library ecosystem (Jackson, resilience4j, metrics)
- **Observability**: Built-in metrics, tracing (Micrometer, Spring Boot
  Actuator)
- **Testing**: Comprehensive test framework (MockMvc, @WebMvcTest)

**Alternatives considered**:

| Framework      | Pros                             | Cons                                     | Verdict                                          |
| -------------- | -------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| **Quarkus**    | Fast startup, native compilation | Less mature, smaller ecosystem           | ✅ Worth considering for cold-start optimization |
| **Micronaut**  | AOT compilation, low memory      | Smaller community than Spring            | ✅ Worth considering for Lambda memory limits    |
| **Vert.x**     | Reactive, high performance       | Steeper learning curve, less opinionated | ❌ Too low-level for business logic              |
| **Dropwizard** | Simple, production-ready         | Less active development                  | ❌ Spring has more momentum                      |

**Decision**: **Start with Spring Boot**, evaluate Quarkus/Micronaut if cold
start or memory becomes an issue.

**Example (Pricing Service)**:

```java
@RestController
@RequestMapping("/price")
public class PricingController {

    @Autowired
    private PricingService pricingService;

    /**
     * @endpoint POST /price
     * @gateway-route POST /api/pricing/v1/price
     * @authentication internal-jwt
     * @scope pricing:read
     */
    @PostMapping
    public ResponseEntity<BondPriceResponse> priceBond(
        @Valid @RequestBody BondPriceRequest request,
        @AuthenticationPrincipal User user
    ) {
        BondPriceResponse response = pricingService.calculatePrice(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public HealthResponse health() {
        return new HealthResponse("healthy", "pricing", "2025.10");
    }
}

// AWS Lambda handler
@Configuration
public class LambdaConfiguration {
    @Bean
    public Function<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> pricing() {
        return new SpringBootRequestHandler<>(PricingApplication.class);
    }
}
```

**Benefits**:

- **Validation annotations**: `@Valid`, `@NotNull`, `@Size` on request models
- **Exception handling**: `@ExceptionHandler` for RFC 7807 responses
- **Testing**: Comprehensive mocking and integration test support
- **Observability**: Actuator endpoints for health, metrics, info
- **Security**: Spring Security for JWT validation (if needed locally)

---

## Consistency Patterns Across Languages

Despite different frameworks, we enforce consistency through:

### 1. Route Structure

```
All services:
  POST   /[operation]        # Primary business operation
  GET    /health             # Health check
  GET    /metrics            # Prometheus metrics (optional)

Gateway routes to:
  /api/{service}/v1/*
```

### 2. Error Responses (RFC 7807)

All frameworks return:

```json
{
  "type": "https://bondmath.chrislyons.dev/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "One or more fields are invalid",
  "errors": [{ "field": "pairs[0].start", "message": "Invalid date format" }]
}
```

### 3. Health Check Response

```json
{
  "status": "healthy",
  "service": "daycount",
  "version": "2025.10"
}
```

### 4. Architecture as Code Annotations

**TypeScript (JSDoc)**:

```typescript
/**
 * @endpoint POST /count
 * @gateway-route POST /api/daycount/v1/count
 * @authentication internal-jwt
 * @scope daycount:read
 */
```

**Python (Docstring)**:

```python
"""
@endpoint POST /value
@gateway-route POST /api/valuation/v1/value
@authentication internal-jwt
@scope valuation:read
"""
```

**Java (Javadoc)**:

```java
/**
 * @endpoint POST /price
 * @gateway-route POST /api/pricing/v1/price
 * @authentication internal-jwt
 * @scope pricing:read
 */
```

### 5. Request/Response Validation

All frameworks enforce:

- Type-safe request models
- Automatic validation before handler execution
- Detailed validation error messages

### 6. Middleware/Interceptor Order

```
1. Logging (request ID, timing)
2. CORS (Gateway only, dev mode)
3. Authentication (JWT validation)
4. Authorization (scope checking)
5. Rate limiting (per user/endpoint)
6. Business logic handler
7. Error normalization (RFC 7807)
8. Response logging
```

---

## Consequences

### Positive

1. **Consistency**: Same patterns across all services despite different
   languages
2. **Developer velocity**: Leverage best-in-class frameworks per ecosystem
3. **Type safety**: Compile-time checking in all languages
4. **Maintainability**: Well-documented, community-supported frameworks
5. **Testing**: All frameworks have excellent test support
6. **Observability**: Built-in metrics, logging, tracing
7. **Onboarding**: New developers can reference official framework docs
8. **Gateway power**: Hono gives us middleware chains for complex routing
9. **API documentation**: FastAPI and Spring Boot auto-generate OpenAPI specs

### Negative

1. **Dependencies**: +1 dependency per service (but all stable, mature)
2. **Learning curve**: Team needs familiarity with 3 frameworks
3. **Bundle size**: Hono adds ~12KB per Worker (negligible)
4. **Abstraction**: Slightly less control than custom routing
5. **Framework updates**: Need to track breaking changes (mitigated by semver)

### Neutral

1. **Different patterns per language**: Acceptable, reflects ecosystem
   conventions
2. **Framework lock-in**: Low risk given maturity and community size
3. **Performance**: Negligible overhead for all frameworks chosen

---

## Alternatives Considered

### Alternative 1: Custom Routers for All Languages

**Approach**: Build lightweight routers in each language

**Pros**:

- Zero dependencies
- Full control
- Minimal bundle size

**Cons**:

- Reinventing middleware (auth, logging, rate limiting)
- Lack of type-safe context passing
- No community support/documentation
- Maintenance burden (3x custom codebases)
- Gateway middleware chain would be complex

**Verdict**: ❌ Not worth the maintenance cost

### Alternative 2: GraphQL Gateway (Apollo, Hasura)

**Approach**: Use GraphQL to unify all service APIs

**Pros**:

- Single query language
- Client-driven data fetching
- Strong typing via schema

**Cons**:

- Overkill for simple REST APIs
- Adds complexity to bond math calculations
- Not REST (consumers may expect REST)
- Requires schema stitching across services

**Verdict**: ❌ Too complex for our use case

### Alternative 3: API Gateway as a Service (Kong, Tyk, AWS API Gateway)

**Approach**: Use managed API gateway instead of custom Gateway Worker

**Pros**:

- Offload auth, rate limiting, logging
- Managed infrastructure

**Cons**:

- Additional cost
- Less control over routing logic
- Vendor lock-in
- Doesn't leverage Cloudflare Service Bindings (zero-latency routing)

**Verdict**: ❌ ADR-0006 already decided on Gateway Worker

### Alternative 4: Same Framework Everywhere (Node.js only)

**Approach**: Write all services in TypeScript with Hono

**Pros**:

- Single language/framework
- Maximum consistency

**Cons**:

- Python has superior numerical/scientific libraries (NumPy, SciPy)
- Java has robust bond pricing libraries (QuantLib-Java)
- Forces team to give up language-specific strengths

**Verdict**: ❌ Conflicts with ADR-0002 (Multi-Language Services)

---

## Risks and Mitigations

### Risk 1: Framework Breaking Changes

**Mitigation**:

- Pin major versions in package.json/requirements.txt/pom.xml
- Subscribe to framework release notes
- Test upgrades in preview environment
- Use Dependabot for automated update PRs

### Risk 2: Performance Overhead

**Mitigation**:

- Benchmark each framework under load
- Monitor cold start times (Lambda)
- Optimize critical paths (disable unnecessary middleware)
- Consider Quarkus/Micronaut for Java if cold start is an issue

### Risk 3: Team Learning Curve

**Mitigation**:

- Create internal guides for each framework
- Pair programming for first implementation
- Code reviews to enforce patterns
- Reference implementations (templates)

### Risk 4: Inconsistent Error Handling

**Mitigation**:

- Shared RFC 7807 error schema (OpenAPI)
- Error handler middleware/interceptor in each framework
- Integration tests verify error format
- Gateway normalizes errors if needed

---

## Related ADRs

- **ADR-0002**: Multi-Language Service Architecture (justifies
  framework-per-language)
- **ADR-0006**: Gateway Worker Pattern (Gateway-specific requirements)
- **ADR-0008**: Same-Origin API Routing (CORS considerations)
- **ADR-0010**: Architecture as Code Conventions (AAC metadata extraction)

---

## References

- [Hono Documentation](https://hono.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [RFC 7807: Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [Cloudflare Workers: Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Mangum: AWS Lambda adapter for ASGI](https://mangum.io/)
- [Spring Cloud Function](https://spring.io/projects/spring-cloud-function)

---

## Approval

- [ ] **Author**: Claude (AI Assistant)
- [ ] **Reviewer**: Chris Lyons (Product Owner)
- [ ] **Date**: 2025-10-05
- [ ] **Status**: Proposed → Accepted (pending approval)

---

## Notes

This ADR establishes routing framework standards that balance consistency with
ecosystem best practices. While we use different frameworks per language, we
enforce consistent patterns through:

1. Shared error response format (RFC 7807)
2. Common health check schema
3. Architecture as Code annotations
4. Middleware/interceptor ordering
5. Request/response validation patterns

The Gateway Worker (Hono) acts as the consistency enforcement point, normalizing
responses and providing a unified API surface to consumers.
