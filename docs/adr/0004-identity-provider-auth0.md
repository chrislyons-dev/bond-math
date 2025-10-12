# ADR 0004 – Auth0 as Identity Provider

**Status:** Accepted **Date:** 2025-10-05 **Context:** Choosing how to handle
user authentication and authorization for _Bond Math_.

---

### 🧩 What we were deciding

I needed to decide **how to manage identity and access** for _Bond Math_. The
project has a **single-page app (Astro)** and a set of **Cloudflare Workers
microservices** that all need secure, standards-based authentication.

I didn’t want to reinvent OAuth or maintain my own user store — I just needed
something reliable, modern, and developer-friendly that supports **OIDC** and
**JWT-based APIs**.

The options were basically:

1. **Auth0** – mature, well-documented, easy integration for SPAs and APIs.
2. **Firebase Auth or Supabase** – simple, but less flexible for custom scopes
   and APIs.
3. **AWS Cognito** – powerful, but clunky and overkill for a personal project.
4. **Self-hosted (Keycloak, Zitadel)** – too heavy for what I need.

---

### ⚖️ The trade-offs

| Option                           | Pros                                                                   | Cons                                                    |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| **Auth0**                        | Clean SDKs, first-class OIDC, supports SPA + API model, good free tier | External dependency, pricing if the app scales          |
| **Firebase / Supabase**          | Quick setup, good for prototypes                                       | Limited custom scopes & API audience support            |
| **AWS Cognito**                  | Deep AWS integration                                                   | More setup, poor developer UX, not worth the complexity |
| **Self-hosted (Keycloak, etc.)** | Full control, open source                                              | Heavy maintenance, overkill for a solo project          |

---

### ✅ Decision

Use **Auth0** as the identity provider for _Bond Math_.

- Auth0 will issue the **user access tokens (OIDC)** for the SPA and APIs.
- The **Gateway Worker** will verify those tokens using Auth0’s JWKS.
- Internally, I’ll mint short-lived service tokens with an **`act` claim** for
  zero-trust propagation between services (see the next ADR).

Auth0 gives me a solid, standards-based foundation for identity without any of
the heavy lifting.

---

### 💬 Why this makes sense for _Bond Math_

- It’s a **personal project**, not a production SaaS — I need something simple
  and free at small scale.
- Auth0’s **SPA + API pattern** maps perfectly to the way I’ve built this system
  (Astro front end → Gateway Worker → microservices).
- Great **developer experience** — I can integrate it with a few lines of code
  and standard OIDC libraries.
- Easy to demonstrate **Architecture as Code** since all config (audience,
  issuer, JWKS) lives in environment variables and IaC.
- If I ever need to migrate, it’s **pure OIDC**, so I’m not locked in.

---

### 🚧 Trade-offs we accept

- I depend on an external service for auth uptime — if Auth0’s down, logins
  won’t work.
- Pricing tiers could matter if this ever scales beyond a hobby project.
- Limited ability to deeply customize login UI without paid tiers.

Those are fine. I’d rather spend time on actual features than managing password
resets or token validation logic.

---

### 📎 Outcome

Auth0 is the right fit for _Bond Math_:

- Standards-based (OIDC + JWT).
- Works perfectly with SPAs and stateless Workers.
- Low-friction setup and great developer ergonomics.
- Easy to extend later with roles, scopes, and custom claims.

It gives me everything I need to show **secure, zero-trust architecture**
without building identity from scratch.
