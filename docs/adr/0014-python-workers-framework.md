# ADR-0014: Python Workers Microframework

**Status:** Accepted **Date:** 2025-10-06 **Context:** ADR-0002 (Service
Languages), ADR-0003 (Cloudflare Hosting), ADR-0010 (HTTP Routing Framework
Standards)

---

## Context

Python services running on Cloudflare Workers have significant runtime
constraints:

- **Pyodide Runtime**: Python runs via WebAssembly with limited stdlib
- **Size Constraints**: Workers bundle must be <1MB compressed
- **No Heavy Frameworks**: FastAPI, Django, Flask too large for Workers
- **No Native Extensions**: Pure Python only (no NumPy, Pandas, pydantic with C
  extensions)

We need a lightweight HTTP routing framework similar to Hono (TypeScript) for
Python Workers, while Lambda-based Python services can use FastAPI (per
ADR-0010).

---

## Decision

Create **flarelette**: a decorator-based microframework for Cloudflare Python
Workers.

### Architecture

```python
from flarelette import (
    WorkersApp,
    Request,
    JsonResponse,
    JWTMiddleware,
    require_scopes,
    validate_body,
    Field,
)

app = WorkersApp()

# Middleware chain
app.use(LoggingMiddleware(logger))
app.use(JWTMiddleware(secret, audience))

# Decorator-based routing
@app.route("/price", methods=["POST"])
@require_scopes("valuation:write")
@validate_body({
    "yield": Field(type=float, required=True),
    "face": Field(type=(int, float), min_value=0),
})
async def calculate_price(request: Request) -> JsonResponse:
    body = await request.json()
    return JsonResponse({"price": 99.95})
```

### Core Features

1. **Routing**: Decorator-based `@app.route(path, methods=[])`
2. **Middleware**: Chain pattern (logging, auth, CORS)
3. **Validation**: Pure Python Field-based validation (no pydantic)
4. **Auth**: JWT middleware with scope-based authorization
5. **Logging**: Structured JSON logging via python-json-logger
6. **Error Handling**: Global error handler with RFC 7807 Problem Details

### Library Structure

```
libs/flarelette/
├── src/flarelette/
│   ├── __init__.py      # Public exports
│   ├── app.py           # WorkersApp, routing
│   ├── request.py       # Request wrapper
│   ├── response.py      # Response, JsonResponse
│   ├── router.py        # Route matching
│   ├── middleware.py    # Middleware base
│   ├── validation.py    # Field, validate_body
│   ├── auth.py          # JWTMiddleware, require_scopes
│   ├── logging.py       # StructuredLogger
│   └── errors.py        # HttpError, ValidationError
└── README.md
```

### Why Not Existing Frameworks?

| Framework | Size   | Issue                                         |
| --------- | ------ | --------------------------------------------- |
| FastAPI   | ~800KB | Too heavy, pydantic C extensions incompatible |
| Flask     | ~400KB | WSGI-based, not async-native                  |
| Starlette | ~300KB | Requires ASGI server                          |
| Quart     | ~350KB | ASGI-based, too heavy                         |
| Falcon    | ~250KB | WSGI-based                                    |

flarelette: **~15KB** pure Python, async-native, zero dependencies beyond
stdlib + python-json-logger.

---

## Validation Approach

No pydantic (C extensions incompatible with Pyodide). Custom Field validation:

```python
Field(
    type=float,
    required=True,
    min_value=0,
    max_value=1,
    enum=[0.01, 0.025, 0.05],
    min_length=1,  # for strings/lists
    max_length=100,
    pattern=r'^\d{4}-\d{2}-\d{2}$',
)
```

Decorators: `@validate_body(schema)`, `@validate_query(schema)`

---

## Authentication Pattern

JWT middleware reads `INTERNAL_JWT_SECRET` from Cloudflare Workers environment:

```python
jwt_secret = os.environ.get("INTERNAL_JWT_SECRET")
if jwt_secret:
    app.use(JWTMiddleware(jwt_secret, f"svc-{SERVICE_NAME}"))
```

Scope-based authorization via decorator:

```python
@require_scopes("valuation:write", "admin:read")
async def handler(request: Request):
    actor = get_actor(request)  # ActorClaim from JWT
```

Follows same pattern as TypeScript services (ADR-0011, ADR-0012).

---

## Consequences

**Positive:**

- Consistent Hono-like API across TypeScript/Python Workers
- Under 1MB bundle size (flarelette + service code)
- Pure Python, no C extensions
- Type hints for IDE support
- Familiar decorator-based routing
- Integrated JWT auth and validation
- Structured logging built-in

**Negative:**

- Custom framework requires maintenance
- Not as feature-rich as FastAPI
- Manual validation vs. pydantic auto-validation
- Team must learn custom framework

**Mitigations:**

- Keep codebase minimal (~500 LOC total)
- Follow Hono patterns for familiarity
- Comprehensive docstrings and examples
- Consider upstreaming if broadly useful

---

## Services Using flarelette

- **bond-valuation** (services/bond-valuation)
- **metrics** (services/metrics)
- **pricing** (services/pricing)

Lambda-based Python services continue using FastAPI per ADR-0010.

---

## Related Documentation

- **Framework Code:** [libs/flarelette](../../libs/flarelette)
- **Related ADRs:** ADR-0002 (Service Languages), ADR-0003 (Cloudflare Hosting),
  ADR-0010 (HTTP Routing Standards), ADR-0011 (Internal JWT), ADR-0013
  (Structured Logging)

---

## References

- [Cloudflare Python Workers](https://developers.cloudflare.com/workers/languages/python/)
- [Pyodide Runtime Constraints](https://pyodide.org/en/stable/usage/wasm-constraints.html)
- [Hono Framework](https://hono.dev/) (inspiration)
- [python-json-logger](https://github.com/madzak/python-json-logger)
