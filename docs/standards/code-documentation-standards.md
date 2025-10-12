# Code Documentation Standards

This document defines documentation and commenting standards for all code in the
**Bond Math** project.

**Contents**

- [Code Documentation Standards](#code-documentation-standards)
  - [📋 Guiding Principles](#-guiding-principles)
  - [🎯 What to Document](#-what-to-document)
    - [**Always Document:**](#always-document)
    - [**Usually Document:**](#usually-document)
    - [**Rarely Document:**](#rarely-document)
  - [📝 Language-Specific Standards](#-language-specific-standards)
    - [**TypeScript / JavaScript**](#typescript--javascript)
      - [Service Metadata Block](#service-metadata-block)
      - [Endpoint Documentation](#endpoint-documentation)
      - [Function Documentation](#function-documentation)
      - [Complex Logic Comments](#complex-logic-comments)
      - [Service Binding Documentation](#service-binding-documentation)
    - [**Python**](#python)
      - [Service Metadata Block](#service-metadata-block-1)
      - [Function Documentation](#function-documentation-1)
      - [Class Documentation](#class-documentation)
      - [Inline Comments for Complex Logic](#inline-comments-for-complex-logic)
    - [**Java**](#java)
      - [Service Metadata](#service-metadata)
      - [Method Documentation](#method-documentation)
  - [🏗️ Architecture as Code Annotations](#️-architecture-as-code-annotations)
    - [Service-Level (Required)](#service-level-required)
    - [Endpoint-Level (For all public/internal APIs)](#endpoint-level-for-all-publicinternal-apis)
    - [Service Binding (Where applicable)](#service-binding-where-applicable)
  - [🔒 Security-Critical Code](#-security-critical-code)
  - [⚠️ Error Handling Documentation](#️-error-handling-documentation)
  - [📦 Configuration and Environment Variables](#-configuration-and-environment-variables)
  - [🧪 Testing Documentation](#-testing-documentation)
  - [📐 API Contracts and Schemas](#-api-contracts-and-schemas)
  - [✅ Documentation Checklist](#-documentation-checklist)
  - [🚫 Anti-Patterns to Avoid](#-anti-patterns-to-avoid)
    - [❌ Obvious Comments](#-obvious-comments)
    - [❌ Outdated Comments](#-outdated-comments)
    - [❌ Commented-Out Code](#-commented-out-code)
    - [❌ TODO Comments Without Context](#-todo-comments-without-context)
  - [📚 Additional Resources](#-additional-resources)

---

## 📋 Guiding Principles

1. **Code should be self-documenting first** – use clear names, small functions,
   and obvious structure
2. **Comments explain WHY, not WHAT** – the code already shows what it does
3. **Document all public APIs** – anything another service or developer will
   call
4. **Keep documentation close to code** – in the same file, not a separate wiki
5. **Update docs in the same commit** – stale docs are worse than no docs

---

## 🎯 What to Document

### **Always Document:**

- Public API endpoints (REST, service bindings)
- Service entry points and main handlers
- Complex business logic or algorithms
- Security-critical code (auth, validation, sanitization)
- Non-obvious performance optimizations
- Workarounds for bugs or limitations
- Architecture metadata with AAC annotations (see ADR-0001) - drives automatic
  diagram/doc generation

### **Usually Document:**

- Exported functions and classes
- Configuration options and environment variables
- Error handling strategies
- Integration points with external services

### **Rarely Document:**

- Simple getters/setters
- Obvious utility functions
- Test code (test names should be self-explanatory)
- Private implementation details

---

## 📝 Language-Specific Standards

### **TypeScript / JavaScript**

Use **JSDoc** for all public APIs.

#### Service Metadata Block

```typescript
/**
 * @service daycount
 * @type cloudflare-worker-typescript
 * @layer business-logic
 * @description Authoritative day-count and year-fraction calculations for fixed income
 * @owner platform-team
 * @internal-routes /count, /health
 * @dependencies none
 * @security-model internal-jwt
 */
```

#### Endpoint Documentation

````typescript
/**
 * Calculates year fractions and accrual days for multiple date pairs.
 *
 * @endpoint POST /api/daycount/v1/count
 * @authentication internal-jwt
 * @scope daycount:read
 * @rate-limit 100/min
 * @cacheable true
 * @cache-ttl 3600
 *
 * @param request - HTTP request with JSON body containing date pairs and convention
 * @returns JSON response with calculated year fractions and day counts
 *
 * @throws {ValidationError} If date format is invalid or convention is unsupported
 * @throws {AuthError} If internal JWT is missing or invalid
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/daycount/v1/count', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': 'Bearer <internal-jwt>'
 *   },
 *   body: JSON.stringify({
 *     pairs: [{ start: '2025-01-31', end: '2025-07-31' }],
 *     convention: '30E_360'
 *   })
 * });
 * ```
 */
export async function handleCount(
  request: Request,
  env: Env
): Promise<Response> {
  // Implementation
}
````

#### Function Documentation

```typescript
/**
 * Validates and normalizes a day-count convention string.
 *
 * Converts user input (case-insensitive) to canonical convention codes.
 * Throws if the convention is not supported.
 *
 * @param convention - User-provided convention string (e.g., "act/360", "30E/360")
 * @returns Normalized convention code (e.g., "ACT_360", "30E_360")
 * @throws {ValidationError} If convention is not recognized
 *
 * @internal
 */
function normalizeConvention(convention: string): DayCountConvention {
  // Implementation
}
```

#### Complex Logic Comments

```typescript
// IMPORTANT: We use the ISDA variant of ACT/ACT here because
// the period straddles a leap year boundary. The denominator
// must be calculated separately for days in each calendar year.
// See: ISDA 2006 definitions, Section 4.16(b)
if (isLeapYearBoundary(start, end)) {
  return calculateActActISDALeapYear(start, end);
}
```

#### Service Binding Documentation

```typescript
/**
 * @service-binding SVC_PRICING
 * @target pricing-engine
 * @purpose Calculate present value of bond cashflows
 * @fallback none (fail fast if unavailable)
 */
const pricingService = env.SVC_PRICING;
```

---

### **Python**

Use **Google-style docstrings** for all public functions and classes.

#### Service Metadata Block

```python
"""
Bond Valuation Service

@service bond-valuation
@type cloudflare-worker-python
@layer business-logic
@description Clean/dirty price ↔ yield conversion and bond schedule generation
@owner platform-team
@internal-routes /price, /yield, /health
@dependencies svc-daycount
@security-model internal-jwt
@sla-tier high
"""
```

#### Function Documentation

```python
def calculate_dirty_price(
    face_value: Decimal,
    coupon_rate: Decimal,
    yield_to_maturity: Decimal,
    periods_remaining: int,
    frequency: int,
    settlement_date: date,
    maturity_date: date,
    convention: str
) -> Decimal:
    """Calculates the dirty price of a bond given its yield.

    The dirty price includes accrued interest since the last coupon payment.
    Uses the standard present value formula for fixed-rate bonds.

    Args:
        face_value: Par value of the bond (e.g., 1000.00)
        coupon_rate: Annual coupon rate as a decimal (e.g., 0.05 for 5%)
        yield_to_maturity: Yield to maturity as a decimal (e.g., 0.04 for 4%)
        periods_remaining: Number of coupon periods until maturity
        frequency: Coupon frequency (1=annual, 2=semi-annual, 4=quarterly)
        settlement_date: Trade settlement date
        maturity_date: Bond maturity date
        convention: Day count convention (e.g., "ACT_360", "30E_360")

    Returns:
        The dirty price as a Decimal, typically expressed per 100 of par value.

    Raises:
        ValidationError: If inputs are invalid (e.g., negative rates, invalid dates)
        ServiceError: If day-count service call fails

    Example:
        >>> calculate_dirty_price(
        ...     face_value=Decimal('1000'),
        ...     coupon_rate=Decimal('0.05'),
        ...     yield_to_maturity=Decimal('0.04'),
        ...     periods_remaining=10,
        ...     frequency=2,
        ...     settlement_date=date(2025, 1, 15),
        ...     maturity_date=date(2030, 1, 15),
        ...     convention='ACT_360'
        ... )
        Decimal('1082.34')

    Note:
        This function calls the day-count service via service binding
        to ensure consistent accrual calculations across all services.
    """
    # Implementation
```

#### Class Documentation

```python
class BondSchedule:
    """Represents a bond's cashflow schedule.

    Attributes:
        issue_date: Date the bond was issued
        maturity_date: Date the bond matures
        coupon_rate: Annual coupon rate (decimal)
        frequency: Coupon frequency (1, 2, or 4)
        convention: Day count convention code
        cashflows: List of scheduled cashflows
    """

    def __init__(
        self,
        issue_date: date,
        maturity_date: date,
        coupon_rate: Decimal,
        frequency: int,
        convention: str
    ):
        """Initializes a BondSchedule.

        Args:
            issue_date: Bond issue date
            maturity_date: Bond maturity date
            coupon_rate: Annual coupon rate as decimal
            frequency: Coupons per year (1, 2, or 4)
            convention: Day count convention
        """
        # Implementation
```

#### Inline Comments for Complex Logic

```python
# WORKAROUND: Python's Decimal division doesn't round the same way
# as Excel's PRICE function for certain edge cases. We use banker's
# rounding (ROUND_HALF_EVEN) to match Excel's behavior, which is
# what traders expect. See issue #23 for details.
price = (pv / face_value * 100).quantize(
    Decimal('0.0001'),
    rounding=ROUND_HALF_EVEN
)
```

---

### **Java**

Use **Javadoc** for all public APIs.

#### Service Metadata

```java
/**
 * Pricing Engine Service
 *
 * @service pricing
 * @type cloudflare-worker-java
 * @layer business-logic
 * @description Discounting engine for bond cashflow present value calculations
 * @owner platform-team
 * @internal-routes /value, /scenario, /key-rate, /health
 * @dependencies none
 * @security-model internal-jwt
 * @sla-tier high
 */
public class PricingEngineWorker implements WorkerEntrypoint {
    // Implementation
}
```

#### Method Documentation

```java
/**
 * Calculates the present value of a series of cashflows.
 *
 * <p>Uses standard discounted cashflow (DCF) analysis with
 * the provided discount rate. All cashflows are assumed to
 * occur at the end of their respective periods.
 *
 * @param cashflows List of future cashflows with amounts and dates
 * @param discountRate Annual discount rate (e.g., 0.05 for 5%)
 * @param settlement Settlement date (present value date)
 * @param convention Day count convention for period calculations
 * @return Present value of all cashflows as of settlement date
 * @throws IllegalArgumentException if discount rate is negative
 * @throws ServiceException if day-count service is unavailable
 *
 * @see <a href="https://en.wikipedia.org/wiki/Discounted_cash_flow">DCF on Wikipedia</a>
 */
public BigDecimal calculatePresentValue(
    List<Cashflow> cashflows,
    BigDecimal discountRate,
    LocalDate settlement,
    String convention
) throws ServiceException {
    // Implementation
}
```

---

## 🏗️ Architecture as Code Annotations

AAC annotations drive automatic generation of C4 diagrams, architecture
documentation, and service discovery via Structurizr DSL.

**For complete AAC annotation syntax and examples, see:**
[AAC Style Guide](../reference/aac-style-guide.md)

**Quick examples from this codebase:**

Service annotations appear at the top of entry point files (`index.ts`,
`main.py`) using `@service`, `@type`, `@layer`, and `@description` tags.
Endpoint annotations use `@endpoint`, `@authentication`, and `@scope` tags.
Service bindings use `@service-binding` to document inter-service dependencies.

**To generate diagrams:** Run `npm run docs:arch`

**For decision rationale:** See
[ADR-0001: Architecture as Code](../adr/0001-architecture-as-code.md)

---

## 🔒 Security-Critical Code

Always document security assumptions and validations:

```typescript
/**
 * Verifies an internal JWT and extracts the actor claim.
 *
 * SECURITY: This function is critical to zero-trust authorization.
 * It must validate:
 * 1. Signature using HMAC-SHA256 and the shared secret
 * 2. Expiration time (reject if exp < now)
 * 3. Audience matches this service's identifier
 * 4. Actor claim structure is valid
 *
 * Do NOT modify this function without security review.
 *
 * @param token - JWT string from Authorization header
 * @param expectedAudience - This service's identifier
 * @param secret - Shared HMAC signing secret
 * @returns Decoded and validated actor claim
 * @throws {AuthError} If any validation fails
 */
function verifyInternalToken(
  token: string,
  expectedAudience: string,
  secret: string
): ActorClaim {
  // Implementation
}
```

---

## ⚠️ Error Handling Documentation

Document error conditions and handling strategy:

```typescript
/**
 * Fetches year fraction from day-count service.
 *
 * Error Handling:
 * - 401/403: Propagate to caller (auth issue)
 * - 429: Retry once with exponential backoff
 * - 500/502/503: Fail fast, no retry (service down)
 * - Network timeout: Fail after 5s, no retry
 *
 * @throws {ServiceError} If day-count service returns non-2xx
 * @throws {TimeoutError} If request exceeds 5 second timeout
 */
async function fetchYearFraction(
  start: string,
  end: string,
  convention: string
): Promise<number> {
  // Implementation
}
```

---

## 📦 Configuration and Environment Variables

Document all environment variables:

```typescript
/**
 * Environment configuration for Gateway Worker.
 *
 * Required Variables:
 * - AUTH0_DOMAIN: Auth0 tenant domain (e.g., "tenant.auth0.com")
 * - AUTH0_AUDIENCE: API identifier from Auth0 dashboard
 * - INTERNAL_JWT_SECRET: HMAC signing secret for internal tokens (min 32 bytes)
 * - INTERNAL_JWT_TTL: Token TTL in seconds (default: 90)
 *
 * Optional Variables:
 * - LOG_LEVEL: Logging verbosity (debug|info|warn|error, default: info)
 * - RATE_LIMIT_WINDOW: Rate limit window in seconds (default: 60)
 *
 * Service Bindings:
 * - SVC_PRICING: Pricing engine worker
 * - SVC_VALUATION: Bond valuation worker
 * - SVC_DAYCOUNT: Day count worker
 * - SVC_METRICS: Metrics worker
 */
interface Env {
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  INTERNAL_JWT_SECRET: string;
  INTERNAL_JWT_TTL?: string;
  LOG_LEVEL?: string;

  SVC_PRICING: Fetcher;
  SVC_VALUATION: Fetcher;
  SVC_DAYCOUNT: Fetcher;
  SVC_METRICS: Fetcher;
}
```

---

## 🧪 Testing Documentation

Test files should have minimal documentation. Test names should be descriptive
enough.

**Good:**

```typescript
describe('ACT/360 year fraction calculation', () => {
  test('returns 0.5 for exactly 180 days', () => {
    // test implementation
  });

  test('returns approximately 1.0139 for 365 days (365/360)', () => {
    // test implementation
  });

  test('handles leap year day correctly', () => {
    // test implementation
  });
});
```

**Bad (over-documented):**

```typescript
/**
 * Test suite for ACT/360 calculations.
 *
 * This suite tests the year fraction calculation...
 * [paragraphs of explanation]
 */
describe('ACT/360 year fraction calculation', () => {
  /**
   * Tests that 180 days returns 0.5
   */
  test('180 day test', () => {
    // ...
  });
});
```

---

## 📐 API Contracts and Schemas

Document request/response formats for all APIs:

````typescript
/**
 * Request body for /api/daycount/v1/count endpoint.
 *
 * @example
 * ```json
 * {
 *   "pairs": [
 *     { "start": "2025-01-31", "end": "2025-07-31" },
 *     { "start": "2025-07-31", "end": "2026-01-31" }
 *   ],
 *   "convention": "30E_360",
 *   "options": {
 *     "eomRule": true
 *   }
 * }
 * ```
 */
interface DayCountRequest {
  /** Array of date pairs to calculate */
  pairs: DatePair[];

  /** Day count convention code */
  convention: DayCountConvention;

  /** Optional calculation parameters */
  options?: {
    /** Apply end-of-month rule (default: false) */
    eomRule?: boolean;
  };
}

/**
 * Date pair for year fraction calculation.
 */
interface DatePair {
  /** Start date in ISO 8601 format (YYYY-MM-DD) */
  start: string;

  /** End date in ISO 8601 format (YYYY-MM-DD) */
  end: string;
}
````

---

## ✅ Documentation Checklist

Before submitting a PR, verify:

- [ ] All public functions have complete documentation
- [ ] Architecture metadata annotations are present and accurate
- [ ] Security-critical code includes security notes
- [ ] Error conditions are documented
- [ ] Environment variables are documented
- [ ] API contracts have examples
- [ ] Complex algorithms include references or explanations
- [ ] Comments explain WHY, not WHAT
- [ ] Documentation uses correct grammar and spelling

---

## 🚫 Anti-Patterns to Avoid

### ❌ Obvious Comments

```typescript
// Bad: States the obvious
let count = 0; // Set count to zero
count++; // Increment count
```

### ❌ Outdated Comments

```typescript
// Bad: Comment doesn't match code
// Returns the user's full name
function getUserEmail(userId: string): string {
  return db.query('SELECT email FROM users WHERE id = ?', userId);
}
```

### ❌ Commented-Out Code

```typescript
// Bad: Don't leave commented-out code
function process() {
  // const oldWay = doSomething();
  // return oldWay.transform();

  return newWay.process();
}
```

**Fix:** Delete it. Git history preserves old code.

### ❌ TODO Comments Without Context

```typescript
// Bad: No context, no owner, no issue
// TODO: Fix this

// Good: Actionable with context
// TODO(chris): Implement retry logic for transient failures. See issue #42.
```

---

## 📚 Additional Resources

- [JSDoc Reference](https://jsdoc.app/)
- [Google Style Guide - Python Docstrings](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)
- [Oracle Javadoc Guide](https://www.oracle.com/technical-resources/articles/java/javadoc-tool.html)
- [AAC Style Guide](../reference/aac-style-guide.md) – Architecture annotation
  reference
- [ADR-0001: Architecture as Code](../adr/0001-architecture-as-code.md) –
  Decision rationale

---

**Remember:** Good documentation is concise, accurate, and maintained. When in
doubt, write less but keep it current.
