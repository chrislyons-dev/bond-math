# ADR 0013 – Structured Logging Standards

**Status:** Accepted **Date:** 2025-10-06 **Context:** Multiple services in
different languages need consistent, aggregation-friendly logging.

---

## 🧩 What we were deciding

How to implement logging across a polyglot microservices architecture so that
logs from TypeScript, Python, and Java services can be easily aggregated,
searched, and correlated.

**Options:**

1. **Plain text logs** – Simple `console.log()` statements, human-readable but
   hard to parse
2. **Service-specific logging** – Each service uses its own format and library
3. **Structured JSON logging** – Consistent JSON schema across all services with
   language-appropriate libraries

---

## ✅ Decision

Adopt **structured JSON logging** with a unified schema across all services.

### Language-Specific Libraries:

| Service Stack               | Library                                | Rationale                                                 |
| --------------------------- | -------------------------------------- | --------------------------------------------------------- |
| **TypeScript / Cloudflare** | `hono-pino` + `pino`                   | Fast, low-overhead JSON logger optimized for Hono/Workers |
| **Python / Cloudflare**     | `python-json-logger` (flarelette)      | Lightweight JSON formatter (~2KB) using stdlib logging    |
| **Java**                    | `logback` + `logstash-logback-encoder` | Enterprise-grade, native JSON output, battle-tested       |

**Note:** Python services running on Cloudflare Workers cannot use heavy
frameworks like FastAPI or `structlog` due to runtime constraints. The
`flarelette` microframework uses Python's stdlib `logging` module with
`python-json-logger` (2KB package) for JSON formatting.

---

## 📋 Unified Log Schema

All services MUST output logs in the following JSON format:

```json
{
  "timestamp": "2025-10-06T17:45:18.123Z",
  "level": "info|warn|error",
  "service": "gateway|daycount|valuation|pricing|analytics",
  "requestId": "uuid-v4",
  "message": "Human-readable message",
  "duration": 125,
  "userId": "auth0|123",
  "path": "/api/daycount/v1/count",
  "method": "POST",
  "status": 200,
  "context": {}
}
```

### Required Fields:

- `timestamp` – ISO 8601 format with milliseconds
- `level` – One of: `debug`, `info`, `warn`, `error`
- `service` – Service identifier (from `@service` annotation)
- `requestId` – UUID v4 for request tracing (propagated via `X-Request-ID`
  header)
- `message` – Human-readable log message

### Optional Fields:

- `duration` – Request duration in milliseconds
- `userId` – Auth0 subject or internal user ID
- `path` – HTTP path
- `method` – HTTP method
- `status` – HTTP status code
- `context` – Service-specific additional data (object)

---

## 🎯 Implementation Requirements

### TypeScript / Cloudflare Workers

**Library:** `hono-pino` + `pino`

```typescript
import { pinoLogger } from 'hono-pino';
import { pino } from 'pino';

// Configure pino logger
const logger = pinoLogger({
  pino: pino({
    level: 'info',
    base: { service: 'gateway' },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  }),
});

// Use as Hono middleware
app.use('*', logger);

// Direct logging
import { logger } from './logger';
logger.info({ userId: '123' }, 'User authenticated');
```

**Benefits:**

- Zero-copy JSON serialization
- Automatic request/response logging
- Low memory overhead for Workers
- Compatible with Hono middleware chain

### Python / Cloudflare Workers

**Library:** `python-json-logger` via `flarelette`

```python
from flarelette.logging import StructuredLogger

logger = StructuredLogger("daycount")
logger.info("request_completed", request_id=req_id, duration=125, status=200)
```

**Installation:**

```bash
pip install flarelette
```

**Configuration:**

- Uses stdlib `logging` module with `python-json-logger` formatter
- Automatic `timestamp`, `service`, `level` fields
- Optional `requestId` for request correlation
- Additional context via kwargs

### Java Services

**Library:** `logback` with `logstash-logback-encoder`

```xml
<encoder class="net.logstash.logback.encoder.LogstashEncoder">
  <includeMdcKeyName>requestId</includeMdcKeyName>
  <includeMdcKeyName>userId</includeMdcKeyName>
</encoder>
```

**MDC Context:**

- Use `MDC.put("requestId", uuid)` for request correlation
- Automatically include in all log entries

---

## 🔗 Request Correlation

**Flow:**

1. Gateway generates `requestId` (UUID v4)
2. Gateway adds `X-Request-ID` header to all requests/responses
3. Downstream services extract `requestId` from header
4. All logs include same `requestId` for end-to-end tracing

**Header:** `X-Request-ID: <uuid-v4>`

This enables distributed tracing across service boundaries without additional
infrastructure.

---

## 📊 Benefits

1. **Aggregation-friendly** – All services output same JSON structure for log
   aggregators (CloudWatch, Datadog, etc.)
2. **Request tracing** – `requestId` correlates logs across multiple services
3. **Type-safe** – Each framework provides typed logging interfaces
4. **Language-appropriate** – Idiomatic libraries for each ecosystem
5. **Cloudflare-optimized** – Workers use lightweight approach suitable for edge
   runtime

---

## 🚧 Trade-offs

- **Migration effort** – Existing `console.log()` calls need replacement
- **Learning curve** – Developers must learn structured logging patterns
- **Verbosity** – JSON logs are less human-readable in raw form (mitigated by
  log viewers)

All worth it for production observability and debugging capabilities.

---

## 🔍 Example Log Entries

### Request Start (Gateway)

```json
{
  "timestamp": "2025-10-06T17:45:18.123Z",
  "level": "info",
  "service": "gateway",
  "requestId": "a3f2c1b0-1234-5678-9abc-def012345678",
  "message": "Request started",
  "method": "POST",
  "path": "/api/daycount/v1/count",
  "userId": "auth0|xyz123"
}
```

### Request Completed (Day Count)

```json
{
  "timestamp": "2025-10-06T17:45:18.248Z",
  "level": "info",
  "service": "daycount",
  "requestId": "a3f2c1b0-1234-5678-9abc-def012345678",
  "message": "Request completed",
  "duration": 125,
  "status": 200,
  "context": {
    "convention": "ACT_360",
    "pairsCount": 1
  }
}
```

### Error (Any Service)

```json
{
  "timestamp": "2025-10-06T17:45:20.500Z",
  "level": "error",
  "service": "valuation",
  "requestId": "b4e3d2c1-5678-1234-9abc-def098765432",
  "message": "Calculation failed",
  "userId": "auth0|abc456",
  "context": {
    "error": "Invalid yield value",
    "code": "INVALID_INPUT"
  }
}
```

---

## 📎 References

- [hono-pino Documentation](https://github.com/maou-shonen/hono-pino)
- [Pino Documentation](https://getpino.io/)
- [python-json-logger](https://github.com/madzak/python-json-logger)
- [flarelette Framework](../../libs/flarelette/README.md)
- [logstash-logback-encoder](https://github.com/logfellow/logstash-logback-encoder)
- [ADR-0002: Service Languages](./0002-service-languages.md)
- [Cloudflare Workers Runtime Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Python Workers](https://developers.cloudflare.com/workers/languages/python/)

---

## 📅 Review Date

2026-01-01 – Evaluate if log aggregation service (Datadog, etc.) requires schema
updates.
