# ADR 0005 – Internal Token with Actor Claim for Zero-Trust Authorization

**Status:** Accepted
**Date:** 2025-10-05
**Context:** Deciding how to securely pass identity and permissions between microservices in _Bond Math_.

---

### 🧩 What we were deciding

Once Auth0 was in place for external identity (see ADR 0004), I still needed to figure out **how the internal services would trust each other**.

The system has a **Gateway Worker** that handles incoming requests from the SPA and fans out to multiple **Cloudflare Workers** — pricing, valuation, day-count, analytics, etc.

Each internal call still needs to know _who_ is acting and _what they’re allowed to do_.
The question was: **how do I propagate that identity across services** without breaking the “zero-trust” model?

---

### ⚖️ The options

| Option                                           | Description                                                                                             | Pros                                                                    | Cons                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **1️⃣ Pass the Auth0 token through**              | Each service verifies the full Auth0 JWT directly                                                       | Simple, minimal code                                                    | Every service depends on Auth0 JWKS; extra latency; larger attack surface |
| **2️⃣ Mint short-lived internal JWTs (Option B)** | Gateway verifies Auth0 → mints new JWT with an `act` (actor) claim saying “Service X acting for User Y” | Keeps Auth0 isolated; fast local verification; clear service identities | Requires gateway signing secret and rotation plan                         |
| **3️⃣ Central authorizer service**                | Dedicated internal AuthZ Worker verifies tokens for others                                              | Single source of truth                                                  | Extra hop, more complexity                                                |

---

### ✅ Decision

Adopt **Option 2 – short-lived internal JWTs with an `act` claim**.

The Gateway Worker will:

1. Verify the user’s Auth0 token once.
2. Mint a tiny internal JWT (≈90 s TTL) signed with a shared secret.
3. Include only the minimal “actor” info — user ID, permissions, and a unique request ID.
4. Send that token to downstream services as `Authorization: Bearer <internal-jwt>`.

Each microservice will verify the internal JWT locally, check the `aud` (its own service name), and enforce permissions from the embedded actor data.

---

### 💬 Why this makes sense for _Bond Math_

- Keeps **Auth0 logic** and network calls contained to one place — the gateway.
- **Zero-trust** at every hop: every service still verifies a cryptographic signature.
- **Clear accountability:** internal token says “service X acting for user Y,” which is great for audit and logs.
- **Fast and lightweight:** no round-trips to Auth0; tokens are tiny and short-lived.
- Easy to demonstrate in code as part of the project’s **Architecture as Code** story.

---

### 🚧 Trade-offs we accept

- We now manage one internal signing secret (needs rotation policy).
  - **Mitigation:** Cloudflare Workers seamless secret management - use `.dev.vars` locally, `wrangler secret put` for production
  - See [Authentication Reference](../reference/authentication.md)
- Services must include simple verification code (~20 lines) and reject expired or wrong-audience tokens.
- Slightly more complexity in the gateway logic, but it's isolated and easy to reason about.

All manageable for the simplicity and security we gain.

---

### 📎 Outcome

This approach gives _Bond Math_ a clean **zero-trust architecture**:

- Every request is signed and scoped.
- Each service verifies who’s calling and on whose behalf.
- No service blindly trusts another — they trust signatures.
- No dependency on Auth0 at runtime for internal hops.

It’s simple, fast, and secure — the right balance for a small, stateless microservices app built on Cloudflare Workers.
