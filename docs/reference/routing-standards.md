# HTTP Routing Framework Standards

**Reference for ADR-0010** | **Version:** 2025.10

Standards and implementation patterns for HTTP routing across all Bond Math
services.

---

## Framework Choices

| Language   | Framework       | Version | Runtime            |
| ---------- | --------------- | ------- | ------------------ |
| TypeScript | **Hono**        | v4.x    | Cloudflare Workers |
| Python     | **FastAPI**     | v0.109+ | AWS Lambda         |
| Java       | **Spring Boot** | v3.2+   | AWS Lambda         |

---

## TypeScript: Hono

### Gateway Worker Example

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

### Service Worker Example

```typescript
import { Hono } from 'hono';

const app = new Hono();

/**
 * @endpoint POST /count
 * @gateway-route POST /api/daycount/v1/count
 * @authentication internal-jwt
 * @scope daycount:write
 */
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

### Why Hono?

- **Built for Cloudflare Workers** - Native Service Bindings, KV, Durable
  Objects
- **Middleware-first** - Essential for Gateway auth, logging, rate limiting
- **Lightweight** - ~12KB, optimized for edge
- **Type-safe** - Full TypeScript with generic contexts
- **Wildcard routing** - Critical for Gateway proxy (`/api/daycount/v1/*`)

---

## Python: FastAPI

### Service Example

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

### Why FastAPI?

- **Industry standard** - De facto Python API framework
- **Type safety** - Pydantic validates requests/responses
- **OpenAPI** - Auto-generated documentation
- **Async/await** - High-performance I/O
- **Dependency injection** - Clean middleware patterns
- **AWS Lambda** - Seamless with Mangum adapter

---

## Java: Spring Boot

### Service Example

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

### Why Spring Boot?

- **Enterprise standard** - Java's most mature web framework
- **Type safety** - Compile-time checking
- **Dependency injection** - IoC container
- **AWS Lambda** - Spring Cloud Function adapter
- **Validation** - JSR-303/Hibernate Validator
- **Observability** - Actuator for metrics/health

---

## Consistency Patterns

### Route Structure

```
All services:
  POST   /[operation]        # Primary business operation
  GET    /health             # Health check
  GET    /metrics            # Prometheus metrics (optional)

Gateway routes to:
  /api/{service}/v1/*
```

### Error Responses (RFC 7807)

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

### Health Check Response

```json
{
  "status": "healthy",
  "service": "daycount",
  "version": "2025.10"
}
```

### Architecture as Code Annotations

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

### Request/Response Validation

All frameworks enforce:

- Type-safe request models
- Automatic validation before handler execution
- Detailed validation error messages

### Middleware/Interceptor Order

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

## Alternatives Evaluated

### TypeScript Alternatives

| Framework       | Pros                            | Cons                                            | Verdict                      |
| --------------- | ------------------------------- | ----------------------------------------------- | ---------------------------- |
| **itty-router** | Tiny (450 bytes), minimal       | No built-in middleware, manual context passing  | ❌ Too minimal for Gateway   |
| **Worktop**     | Full-featured, CF-native        | Less active maintenance, smaller community      | ❌ Ecosystem concerns        |
| **sunder**      | Express-like API                | Heavier, less CF-specific                       | ❌ Not optimized for Workers |
| **Custom**      | Zero dependencies, full control | Reinventing middleware, context, error handling | ❌ Maintenance burden        |

### Python Alternatives

| Framework                 | Pros                    | Cons                                  | Verdict                       |
| ------------------------- | ----------------------- | ------------------------------------- | ----------------------------- |
| **Flask**                 | Simple, minimal         | No built-in validation, limited async | ❌ Too minimal                |
| **Django REST Framework** | Full-featured, admin UI | Heavy, overkill for microservices     | ❌ Too heavy                  |
| **Starlette**             | Lightweight, async      | Less built-in validation than FastAPI | ❌ FastAPI built on Starlette |
| **Chalice**               | AWS-native, simple      | Limited community, AWS lock-in        | ❌ Prefer standard frameworks |

### Java Alternatives

| Framework      | Pros                             | Cons                                     | Verdict                                          |
| -------------- | -------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| **Quarkus**    | Fast startup, native compilation | Less mature, smaller ecosystem           | ✅ Worth considering for cold-start optimization |
| **Micronaut**  | AOT compilation, low memory      | Smaller community than Spring            | ✅ Worth considering for Lambda memory limits    |
| **Vert.x**     | Reactive, high performance       | Steeper learning curve, less opinionated | ❌ Too low-level for business logic              |
| **Dropwizard** | Simple, production-ready         | Less active development                  | ❌ Spring has more momentum                      |

---

## Risk Mitigations

### Framework Breaking Changes

- Pin major versions in package.json/requirements.txt/pom.xml
- Subscribe to framework release notes
- Test upgrades in preview environment
- Use Dependabot for automated update PRs

### Performance Overhead

- Benchmark each framework under load
- Monitor cold start times (Lambda)
- Optimize critical paths (disable unnecessary middleware)
- Consider Quarkus/Micronaut for Java if cold start is an issue

### Team Learning Curve

- Create internal guides for each framework
- Pair programming for first implementation
- Code reviews to enforce patterns
- Reference implementations (templates)

### Inconsistent Error Handling

- Shared RFC 7807 error schema (OpenAPI)
- Error handler middleware/interceptor in each framework
- Integration tests verify error format
- Gateway normalizes errors if needed

---

## References

- [Hono Documentation](https://hono.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [RFC 7807: Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [Cloudflare Workers: Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Mangum: AWS Lambda adapter for ASGI](https://mangum.io/)
- [Spring Cloud Function](https://spring.io/projects/spring-cloud-function)
