# ⚙️ Day-Count Microservice

The **Day-Count Worker** is the authoritative source for **accrual-day and
year-fraction** calculations across _Bond Math_.  
It provides a consistent, versioned implementation of the major day-count
conventions used in global fixed income markets.

The service exists to ensure that **every calculation in every language (Python,
Java, TypeScript)** uses the same logic and conventions.  
Results are deterministic, testable, and versioned — making them safe to cache
and compare across services.

---

## 🔌 Consumption Patterns

1. **Internal (preferred)** – Other Workers call it via **Service Bindings**.
   - No public hop.
   - Lowest latency.
   - Traffic stays entirely on Cloudflare’s backbone.

2. **Public (through API Gateway)** – Exposed as a **versioned endpoint** for
   the Astro UI, partner integrations, and testing.
   - Protected by **Auth0 (OIDC)** for user authentication.
   - Enforced rate limits, quotas, and analytics via API Gateway.
   - Returns identical responses as the internal binding.

---

## 📅 Supported Day-Count Conventions

| Convention Name              | Description                                                                | API `convention` Value | Typical Usage                                                          |
| ---------------------------- | -------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| **U.S. 30/360 (Bond Basis)** | Each month treated as 30 days; year fixed at 360. Simple, uniform accrual. | `"30_360"`             | U.S. corporate and municipal bonds, agency issues.                     |
| **European 30E/360**         | Each month = 30 days; both start and end set to 30 when applicable.        | `"30E_360"`            | Eurobonds, European corporates and sovereigns.                         |
| **Actual/360**               | Uses actual days between dates divided by 360.                             | `"ACT_360"`            | U.S. money-market instruments (CDs, CP, T-bills), Eurodollar deposits. |
| **Actual/365 (Fixed)**       | Actual days divided by 365, regardless of leap years.                      | `"ACT_365F"`           | GBP and CAD money-market instruments, many Asian markets.              |
| **Actual/Actual (ISDA)**     | Actual days; denominator = actual days in each year (365 or 366).          | `"ACT_ACT_ISDA"`       | U.S. Treasuries, sovereign bonds.                                      |
| **Actual/Actual (ICMA)**     | Coupon-period-based method, adjusts for varying coupon frequencies.        | `"ACT_ACT_ICMA"`       | Semiannual coupon government and corporate bonds (Eurobonds).          |

---

## 🧠 Implementation Notes

- Deterministic: Identical input → identical output.
- Cacheable: Safe for Cloudflare edge caching; responses are immutable.
- Versioned: Each deployment includes a semantic version (YYYY.MM) to trace
  calculations.
- Secure:
  - Public route: verified with Auth0 (OIDC).
  - Internal binding: verified with short-lived internal JWT including an act
    (actor) claim.
- Extensible: New conventions can be added without breaking existing API
  contracts.
- Fallbacks: Clients can include local stubs if the Worker is unreachable
  (mainly for testing).

---

## 🚀 Usage

**Request**

```bash
POST /api/daycount/v1/count
Content-Type: application/json
Authorization: Bearer <token>

{
  "pairs": [
    {"start": "2025-01-31", "end": "2025-07-31"},
    {"start": "2025-07-31", "end": "2026-01-31"}
  ],
  "convention": "30E_360",
  "options": {
    "eomRule": true
  },
  "version": "2025.10"
}
```

**Response**

```json
{
  "results": [
    { "days": 180, "yearFraction": 0.5, "basis": 360 },
    { "days": 180, "yearFraction": 0.5, "basis": 360 }
  ],
  "convention": "30E_360",
  "version": "2025.10"
}
```
