# Testing Standards

This document defines testing standards, conventions, and best practices for the
**Bond Math** project.

---

## 🎯 Testing Philosophy

1. **Tests are documentation** – they show how code should be used
2. **Tests enable refactoring** – change internals with confidence
3. **Fast feedback loops** – tests should run quickly and fail clearly
4. **Test behavior, not implementation** – focus on inputs/outputs, not
   internals
5. **Write tests first for bugs** – reproduce, then fix, then verify

---

## 📊 Test Pyramid

We follow a balanced test pyramid:

```
        ╱╲
       ╱ E2E ╲         10%  - End-to-end tests
      ╱────────╲
     ╱          ╲
    ╱ Integration╲      30%  - Integration tests
   ╱──────────────╲
  ╱                ╲
 ╱   Unit Tests     ╲   60%  - Unit tests
╱────────────────────╲
```

### **Unit Tests (60%)**

- Test individual functions and modules in isolation
- Mock external dependencies
- Fast (< 1ms per test)
- No network calls, no real services

### **Integration Tests (30%)**

- Test service-to-service interactions
- Use real service bindings (or Wrangler local mode)
- Test API contracts
- Verify authentication/authorization flows

### **End-to-End Tests (10%)**

- Test complete user workflows
- Use deployed preview environments
- Test UI → Gateway → Services → back
- Verify production-like scenarios

---

## 🗂️ Test Organization

```
tests/
├── unit/                           # Unit tests (co-located with source preferred)
│   ├── gateway/
│   │   ├── auth.test.ts
│   │   ├── jwt.test.ts
│   │   └── routing.test.ts
│   ├── daycount/
│   │   ├── act-360.test.ts
│   │   ├── act-365f.test.ts
│   │   └── 30e-360.test.ts
│   └── ...
├── integration/                    # Cross-service tests
│   ├── gateway-to-daycount.test.ts
│   ├── valuation-to-daycount.test.ts
│   ├── auth-flow.test.ts
│   └── ...
├── e2e/                           # End-to-end tests
│   ├── bond-pricing-flow.test.ts
│   ├── metrics-calculation.test.ts
│   └── ...
├── load/                          # Performance and load tests
│   ├── gateway-load.js
│   └── ...
└── fixtures/                      # Shared test data
    ├── bonds.json
    ├── tokens.json
    └── ...
```

**Alternative (Co-located):** Unit tests can live alongside source files:

```
services/
├── gateway/
│   ├── src/
│   │   ├── auth.ts
│   │   ├── auth.test.ts       ← Unit test next to source
│   │   ├── jwt.ts
│   │   └── jwt.test.ts
```

---

## 🧪 Test Coverage Requirements

### **Minimum Coverage Targets**

| Type                  | Target | Enforcement |
| --------------------- | ------ | ----------- |
| Overall Line Coverage | 80%    | CI warning  |
| Critical Paths        | 100%   | CI failure  |
| Public APIs           | 100%   | CI failure  |
| Security Code         | 100%   | CI failure  |

### **Critical Paths (Must Have 100% Coverage)**

- Authentication and authorization
- Token minting and validation
- Input validation and sanitization
- Financial calculations (pricing, yield, duration, convexity)
- Day-count convention implementations
- Error handling for security-critical flows

---

## ✍️ Writing Good Tests

### **Test Naming**

Use descriptive names that read like specifications:

**Pattern:** `test('should [expected behavior] when [condition]')`

**Good:**

```typescript
describe('JWT verification', () => {
  test('should reject token when signature is invalid', () => {});
  test('should reject token when expiration has passed', () => {});
  test('should reject token when audience does not match', () => {});
  test('should accept valid token with correct claims', () => {});
});
```

**Bad:**

```typescript
describe('JWT', () => {
  test('test1', () => {});
  test('invalid token', () => {});
  test('works', () => {});
});
```

### **Test Structure: Arrange-Act-Assert (AAA)**

```typescript
test('should calculate ACT/360 year fraction for 180 days', () => {
  // Arrange: Set up test data
  const start = '2025-01-01';
  const end = '2025-07-01'; // 181 days
  const convention = 'ACT_360';

  // Act: Execute the function
  const result = calculateYearFraction(start, end, convention);

  // Assert: Verify the outcome
  expect(result).toBeCloseTo(181 / 360, 6);
});
```

### **Test Isolation**

Each test must be independent:

```typescript
// Good: Self-contained test
test('should increment counter', () => {
  const counter = new Counter(); // Fresh instance
  counter.increment();
  expect(counter.value).toBe(1);
});

// Bad: Shared state between tests
let sharedCounter = new Counter(); // ❌ Pollutes other tests

test('test1', () => {
  sharedCounter.increment();
  expect(sharedCounter.value).toBe(1);
});

test('test2', () => {
  sharedCounter.increment();
  expect(sharedCounter.value).toBe(2); // ❌ Depends on test1 running first
});
```

### **Use Descriptive Variables**

```typescript
// Good: Clear intent
test('should reject expired token', () => {
  const expiredToken = createToken({ exp: Date.now() - 1000 });
  expect(() => verifyToken(expiredToken)).toThrow(AuthError);
});

// Bad: Cryptic
test('should reject expired token', () => {
  const t = createToken({ exp: Date.now() - 1000 });
  expect(() => verifyToken(t)).toThrow(AuthError);
});
```

---

## 🔧 Testing by Language

### **TypeScript (Vitest)**

**Setup:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/dist/**'],
    },
  },
});
```

**Example Test:**

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { verifyInternalToken } from './jwt';

describe('verifyInternalToken', () => {
  const secret = 'test-secret-min-32-bytes-long!';
  const audience = 'svc-daycount';

  test('should return actor claim for valid token', () => {
    const token = createTestToken({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 60,
      act: { sub: 'user123', perms: ['daycount:read'] },
    });

    const result = verifyInternalToken(token, audience, secret);

    expect(result.sub).toBe('user123');
    expect(result.perms).toContain('daycount:read');
  });

  test('should throw AuthError when token is expired', () => {
    const expiredToken = createTestToken({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) - 60, // 60 seconds ago
    });

    expect(() => verifyInternalToken(expiredToken, audience, secret)).toThrow(
      AuthError
    );
  });
});
```

**Mocking Service Bindings:**

```typescript
import { vi } from 'vitest';

test('should call day-count service via binding', async () => {
  const mockDayCount = {
    fetch: vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ yearFraction: 0.5 }))),
  };

  const env = { SVC_DAYCOUNT: mockDayCount };

  await calculatePrice(env, bondParams);

  expect(mockDayCount.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/daycount/v1/count'),
    expect.objectContaining({ method: 'POST' })
  );
});
```

---

### **Python (pytest)**

**Setup:**

```python
# pyproject.toml or pytest.ini
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = [
    "--strict-markers",
    "--cov=services",
    "--cov-report=term-missing",
    "--cov-report=html",
    "--cov-fail-under=80"
]
```

**Example Test:**

```python
import pytest
from decimal import Decimal
from datetime import date
from services.valuation.pricing import calculate_dirty_price
from services.valuation.exceptions import ValidationError

class TestDirtyPriceCalculation:
    """Tests for dirty price calculation."""

    def test_should_calculate_price_above_par_when_coupon_exceeds_yield(self):
        """Bond trades at premium when coupon > yield."""
        # Arrange
        face_value = Decimal('1000')
        coupon_rate = Decimal('0.06')  # 6%
        ytm = Decimal('0.04')  # 4%
        periods = 10
        frequency = 2

        # Act
        price = calculate_dirty_price(
            face_value, coupon_rate, ytm, periods, frequency
        )

        # Assert
        assert price > face_value  # Premium bond
        assert price == pytest.approx(Decimal('1162.22'), rel=Decimal('0.01'))

    def test_should_raise_validation_error_for_negative_coupon(self):
        """Negative coupon rates are not allowed."""
        with pytest.raises(ValidationError, match='Coupon rate must be non-negative'):
            calculate_dirty_price(
                face_value=Decimal('1000'),
                coupon_rate=Decimal('-0.01'),  # Invalid
                ytm=Decimal('0.04'),
                periods=10,
                frequency=2
            )

    @pytest.mark.parametrize('frequency,expected_periods_per_year', [
        (1, 1),   # Annual
        (2, 2),   # Semi-annual
        (4, 4),   # Quarterly
    ])
    def test_should_handle_different_coupon_frequencies(
        self, frequency, expected_periods_per_year
    ):
        """Test calculation works for various coupon frequencies."""
        # ... test implementation
```

**Mocking External Services:**

```python
from unittest.mock import Mock, patch
import pytest

@pytest.fixture
def mock_daycount_service():
    """Mock day-count service responses."""
    mock = Mock()
    mock.calculate_year_fraction.return_value = 0.5
    return mock

def test_should_call_daycount_service_for_accrual(mock_daycount_service):
    """Valuation service should delegate to day-count service."""
    with patch('services.valuation.daycount_client', mock_daycount_service):
        result = calculate_accrued_interest(
            settlement=date(2025, 1, 1),
            last_coupon=date(2024, 7, 1),
            convention='ACT_360'
        )

        mock_daycount_service.calculate_year_fraction.assert_called_once_with(
            start=date(2024, 7, 1),
            end=date(2025, 1, 1),
            convention='ACT_360'
        )
```

---

### **Java (JUnit 5)**

**Setup:**

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.10.0</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-core</artifactId>
    <version>5.5.0</version>
    <scope>test</scope>
</dependency>
```

**Example Test:**

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@DisplayName("Present Value Calculation")
class PresentValueCalculatorTest {

    @Test
    @DisplayName("should calculate PV correctly for single cashflow")
    void shouldCalculatePresentValueForSingleCashflow() {
        // Arrange
        var calculator = new PresentValueCalculator();
        var cashflow = new Cashflow(
            new BigDecimal("100"),
            LocalDate.of(2026, 1, 1)
        );
        var discountRate = new BigDecimal("0.05");
        var settlement = LocalDate.of(2025, 1, 1);

        // Act
        BigDecimal pv = calculator.calculate(
            List.of(cashflow),
            discountRate,
            settlement
        );

        // Assert
        assertTrue(pv.compareTo(new BigDecimal("95.00")) > 0);
        assertTrue(pv.compareTo(new BigDecimal("96.00")) < 0);
    }

    @Test
    @DisplayName("should throw exception for negative discount rate")
    void shouldRejectNegativeDiscountRate() {
        var calculator = new PresentValueCalculator();

        assertThrows(IllegalArgumentException.class, () -> {
            calculator.calculate(
                Collections.emptyList(),
                new BigDecimal("-0.01"),
                LocalDate.now()
            );
        });
    }

    @ParameterizedTest
    @CsvSource({
        "0.03, 97.09",
        "0.05, 95.24",
        "0.10, 90.91"
    })
    @DisplayName("should calculate different PVs for different discount rates")
    void shouldCalculatePVForVariousRates(String rate, String expectedPV) {
        // ... test implementation
    }
}
```

---

## 🔗 Integration Testing

### **Testing Service Bindings**

Use **Wrangler local mode** to test real service bindings:

```typescript
// integration/gateway-to-daycount.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';

describe('Gateway → DayCount Integration', () => {
  let gateway: any;
  let daycount: any;

  beforeAll(async () => {
    // Start both workers locally
    daycount = await unstable_dev('services/daycount/src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });

    gateway = await unstable_dev('services/gateway/src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      bindings: {
        SVC_DAYCOUNT: daycount.fetch,
      },
    });
  });

  afterAll(async () => {
    await gateway.stop();
    await daycount.stop();
  });

  test('should route daycount request through gateway', async () => {
    const response = await gateway.fetch('/api/daycount/v1/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${createTestToken()}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-07-01' }],
        convention: 'ACT_360',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.results[0].yearFraction).toBeCloseTo(0.5, 2);
  });
});
```

### **Testing Authentication Flows**

```typescript
test('should reject request with expired Auth0 token', async () => {
  const expiredToken = createExpiredAuth0Token();

  const response = await gateway.fetch('/api/valuation/v1/price', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${expiredToken}`,
    },
  });

  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({
    type: 'https://bondmath.dev/errors/auth',
    title: 'Unauthorized',
    detail: expect.stringContaining('expired'),
  });
});
```

---

## 🎭 Test Doubles: Mocks, Stubs, Fakes

### **When to Use Each**

- **Stub**: Returns hardcoded data (for queries)
- **Mock**: Verifies interactions (for commands)
- **Fake**: Working implementation (for complex dependencies)

```typescript
// Stub: Just returns data
const stubDayCount = {
  fetch: () =>
    Promise.resolve(new Response(JSON.stringify({ yearFraction: 0.5 }))),
};

// Mock: Verifies the call happened
const mockDayCount = {
  fetch: vi.fn().mockResolvedValue(new Response('{"yearFraction": 0.5}')),
};
// Later: expect(mockDayCount.fetch).toHaveBeenCalledTimes(1);

// Fake: In-memory implementation
class FakeDayCountService {
  async fetch(request: Request): Promise<Response> {
    // Actually calculate year fractions in-memory
    const body = await request.json();
    const result = this.calculateLocally(body);
    return new Response(JSON.stringify(result));
  }
}
```

---

## 🏃 Performance and Load Testing

Use **k6** for load testing Workers:

```javascript
// tests/load/gateway-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up
    { duration: '1m', target: 50 }, // Steady state
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% under 500ms
    http_req_failed: ['rate<0.01'], // < 1% errors
  },
};

export default function () {
  const payload = JSON.stringify({
    pairs: [{ start: '2025-01-01', end: '2025-07-01' }],
    convention: 'ACT_360',
  });

  const response = http.post(
    'https://bondmath.chrislyons.dev/api/daycount/v1/count',
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${__ENV.TEST_TOKEN}`,
      },
    }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

Run: `k6 run tests/load/gateway-load.js`

---

## ✅ CI/CD Integration

### **GitHub Actions Workflow**

```yaml
name: Test

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3

      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to preview
        run: wrangler deploy --env preview

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          E2E_BASE_URL: https://preview.bondmath.chrislyons.dev
```

---

## 📋 Testing Checklist

Before submitting a PR:

- [ ] All new code has unit tests
- [ ] Public APIs have integration tests
- [ ] Critical paths have 100% coverage
- [ ] Tests pass locally (`npm test`)
- [ ] Tests are isolated (no shared state)
- [ ] Test names are descriptive
- [ ] No commented-out tests
- [ ] No `test.skip` or `test.only` in committed code
- [ ] Mocks are used appropriately (not over-mocked)
- [ ] Tests run fast (< 5 seconds for unit tests)

---

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [pytest Documentation](https://docs.pytest.org/)
- [JUnit 5 Documentation](https://junit.org/junit5/docs/current/user-guide/)
- [k6 Load Testing](https://k6.io/docs/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Remember:** Tests are code too. Keep them clean, maintainable, and
trustworthy.
