# ADR 0006 – Gateway Worker Design

**Status:** Accepted
**Date:** 2025-10-05
**Context:** Defining how API requests flow through the _Bond Math_ system and how authentication, authorization, and routing are handled at the edge.

---

### 🧩 What we were deciding

I needed a **single entry point** for the _Bond Math_ system — a place where all requests from the UI hit first, authentication happens once, and internal routing is handled cleanly.

Everything runs on **Cloudflare Workers**, the choices were:

- Use a gateway to handle routing, auth, and zero-trust propagation. The gateway would sit between the Astro SPA and all internal Workers (pricing, valuation, day count, etc.).
- Each service handles auth and zero-trust propagation itself.

---

### ⚖️ The options

| Option                                    | Description                                                                         | Pros                                                                      | Cons                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **1️⃣ No gateway (UI calls each service)** | The SPA talks directly to each microservice                                         | Simple at first, fewer moving parts                                       | Every service must verify Auth0 tokens and handle CORS; duplicate logic; no unified routing |
| **2️⃣ Dedicated Gateway Worker**           | A single Worker verifies Auth0, mints internal JWTs, and routes requests internally | Centralized auth, consistent routing, cleaner code, faster internal calls | Slightly more up-front setup; one more deployment                                           |
| **3️⃣ External API gateway service**       | Use a managed API gateway (Cloudflare Zero Trust Gateway, AWS API Gateway, etc.)    | Built-in policies and logs                                                | Overkill for a personal project; less control over flows; added cost/complexity             |

---

### ✅ Decision

Build a **custom Gateway Worker** using Cloudflare Workers and service bindings.

It acts as the **front door** for all API requests, doing three key things:

1. **Authentication** – Verifies the user’s Auth0 access token (OIDC).
2. **Authorization Propagation** – Mints a short-lived internal JWT with an `act` (actor) claim for downstream services.
3. **Routing** – Forwards requests to the correct internal service via service bindings (`SVC_PRICING`, `SVC_VAL`, etc.).

All internal services verify the internal JWT locally — meaning every hop remains zero-trust and stateless.

---

### 💬 Why this makes sense for _Bond Math_

- It keeps **Auth0 integration and validation** in one place — the gateway — so the other Workers stay small and focused.
- **Service bindings** let all communication stay inside Cloudflare’s edge network (fast, secure, no public exposure).
- Enables a clean **“Service X acting for User Y”** pattern, which is critical for logging, auditing, and zero-trust compliance.
- Matches the project’s theme of **clarity, simplicity, and Architecture as Code** — it’s easy to diagram and reason about.

---

### 🚧 Trade-offs we accept

- The gateway becomes a **critical path** — if it fails, the API fails (though Cloudflare's global replication makes this very low risk).
- Slightly more moving parts compared to each Worker doing its own verification.
- We maintain a **shared signing secret** for internal JWTs (rotation policy needed).
  - **Mitigation:** Cloudflare's encrypted secret storage + simple rotation procedure
  - See [Authentication Reference](../reference/authentication.md)

These are reasonable trade-offs for the security and maintainability benefits.

---

### 📎 Outcome

The **Gateway Worker** is now the official **entry point and trust anchor** for _Bond Math_.

- It verifies external identity (Auth0).
- It mints internal trust tokens (short-lived JWTs).
- It routes requests to internal Workers using service bindings.
- It keeps the whole system **stateless, secure, and edge-native**.

This design gives _Bond Math_ a simple, fast, and consistent way to enforce **zero-trust principles** without adding extra infrastructure or complexity.
