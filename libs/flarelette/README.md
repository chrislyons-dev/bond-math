# flarelette

Lightweight API framework for Cloudflare Python Workers - like Starlette but for
Workers.

**Version:** 0.1.2

## Features

- Flask-style routing with decorators
- Schema-based request validation (no pydantic)
- Structured JSON logging
- Middleware support
- Security headers by default
- Type-safe with full type hints
- Single dependency: `python-json-logger` (2KB)

## Quick Start

```python
from flarelette import App, Request, JsonResponse, Field, validate_body
from flarelette.logging import StructuredLogger, LoggingMiddleware

# Initialize app
app = App()
logger = StructuredLogger("my-service")

# Add logging middleware
app.use(LoggingMiddleware(logger))

# Define routes with validation
@app.route("/health", methods=["GET"])
async def health(request: Request) -> JsonResponse:
    return JsonResponse({"status": "healthy"})

@app.route("/api/data", methods=["POST"])
@validate_body({
    "name": Field(type=str, required=True, min_length=1),
    "value": Field(type=float, required=True, min_value=0),
    "category": Field(type=str, required=False, enum=["A", "B", "C"]),
})
async def process_data(request: Request) -> JsonResponse:
    data = await request.json()  # Already validated
    return JsonResponse({"result": "success"})

# Error handling
@app.error_handler
async def handle_error(error: Exception) -> JsonResponse:
    logger.error("Unhandled error", error=str(error))
    return JsonResponse(
        {"error": "Internal Server Error"},
        status=500
    )

# Export for Cloudflare Workers
async def on_fetch(request):
    response = await app.handle(request)
    return response.to_workers_response()
```

---

## Components

| Component             | Purpose                         |
| --------------------- | ------------------------------- |
| `App`                 | Route registration and handling |
| `Router`              | Route matching                  |
| `Request`             | Request wrapper with validation |
| `Response`            | Response builder with security  |
| `Field`               | Validation rules                |
| `validate_body`       | Request validation decorator    |
| `StructuredLogger`    | JSON logging (ADR-0013)         |
| `LoggingMiddleware`   | Request/response logging        |
| `HttpError` hierarchy | Type-safe error handling        |

## Validation

### Field Rules

```python
Field(
    type=str|int|float|bool|list|dict,  # Required: expected type
    required=True|False,                 # Default: True
    min_length=int,                      # For strings, lists, dicts
    max_length=int,                      # For strings, lists, dicts
    min_value=int|float,                 # For numeric types
    max_value=int|float,                 # For numeric types
    enum=list,                           # Allowed values
    pattern=str,                         # Regex pattern (for strings)
)
```

### Example

```python
@app.route("/calculate", methods=["POST"])
@validate_body({
    "settlementDate": Field(type=str, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    "couponRate": Field(type=float, min_value=0, max_value=1),
    "frequency": Field(type=int, enum=[1, 2, 4, 12]),
    "pairs": Field(type=list, min_length=1),
    "options": Field(type=dict, required=False),
})
async def calculate(request: Request) -> JsonResponse:
    body = await request.json()  # Already validated
    return JsonResponse({"result": "success"})
```

Validation errors return 422 with descriptive messages.

## Security

- Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `X-XSS-Protection`
- Schema validation with type checking
- Safe error messages (no stack traces in responses)
- Structured error logging

## Testing

```bash
pytest                  # Run tests
pytest --cov           # Coverage
mypy src/flarelette    # Type check
ruff check src         # Lint
black src              # Format
```
