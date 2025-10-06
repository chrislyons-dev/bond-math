# ADR 0006 – Centralized Day-Count Microservice

**Status:** Accepted  
**Date:** 2025-10-05  
**Context:** Deciding how to handle day-count conventions across _Bond Math_
services.

---

### 🧩 What we were deciding

Every service in _Bond Math_ needs to calculate year fractions and accrual days
for bonds —  
things like **ACT/360**, **30E/360**, **ACT/365F**, and others.

I had to decide whether each service should handle that math internally,  
use a shared library, or call a separate service that provides it.

The goal isn’t just getting the math right — it’s **keeping the logic
consistent**  
across different runtimes (Python, TypeScript, and Java).

---

### ⚖️ The trade-offs

| Option                          | Pros                                                  | Cons                                                             |
| ------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| **Local logic in each service** | Fast, self-contained                                  | Hard to keep consistent across languages; logic drifts over time |
| **Shared library**              | Central definition, no HTTP call                      | Needs to be maintained and published for each language runtime   |
| **Dedicated microservice**      | One implementation, all clients consistent, versioned | Slight latency hit, one more deployment to manage                |

In a **real production project**, the **shared library** would be the most
practical.  
Maintaining the same financial math in three codebases is not something I’d ever
want to do long-term.  
That’s just asking for subtle differences, testing pain, and extra overhead.

But for _Bond Math_, the purpose is to **demonstrate Architecture as Code**,  
and the day-count service gives a clear example of cross-service, cross-language
integration.  
It makes the architecture more interesting — and easier to visualize.

---

### ✅ Decision

Use a **centralized Day-Count microservice**, written in **TypeScript**,
deployed as a **Cloudflare Worker**.

- Exposes `/api/daycount/v1/year-fraction` for year-fraction and day-count
  calculations.
- All other services (Python and Java) call it through Cloudflare **Service
  Bindings** or HTTP.
- Responses are **cached at the edge** (deterministic and immutable).
- Services can **fall back to a local stub** if needed.
- Each response includes a **version tag** (e.g., `version: "2025.10"`) for
  traceability.

---

### 💬 Why this makes sense for _Bond Math_

- It showcases **Architecture as Code** in action — shared logic defined as a
  service.
- Demonstrates **Cloudflare Service Bindings** and edge caching.
- Keeps all day-count conventions consistent and versioned.
- Makes the architecture diagram richer and more realistic.
- Provides a good example of balancing performance, maintainability, and
  simplicity.

---

### 🚧 Trade-offs we accept

- Adds one more deployable unit to maintain.
- Slight network overhead (though negligible on Cloudflare’s internal network).
- Not how you’d structure a production system that all used the same language.

That last point matters:  
in a real-world Python-only or Java-only system, I’d package this logic as a
shared library instead.  
But since _Bond Math_ intentionally uses three different languages,  
this approach better demonstrates **cross-language consistency and Architecture
as Code principles**.

---

### 📎 Outcome

The **Day-Count Worker** acts as a single, authoritative source of truth for
date math.  
It’s fast, consistent, and easy to test — and it helps make the _Bond Math_
architecture feel like a real distributed system,  
without turning into a maintenance headache.
