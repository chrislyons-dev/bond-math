# 🧭 Gateway Worker

**Service:** `gateway` **Type:** Cloudflare Worker **Purpose:** Entry point and
security gate for all API traffic in the _Bond Math_ system.

---

### 🧩 What it is

The **Gateway Worker** is the front door for everything in _Bond Math_. It’s the
single Cloudflare Worker that receives requests from the UI (Astro SPA) and
decides:

1. **Who’s calling** (Auth0 identity verification).
2. **What they can do** (permissions).
3. **Where the request should go** (routing to internal services).

Think of it as a lightweight **API gateway** and **auth proxy**, built entirely
with Workers and service bindings — no extra infrastructure.

---

### ⚙️ What it does

The Gateway Worker handles three main jobs:

1. **Authentication**
   - It verifies the user’s **Auth0 access token** using Auth0’s JWKS (standard
     OIDC verification).
   - If the token is invalid or missing, it returns `401 Unauthorized`.

2. **Internal Token Minting**
   - Once the Auth0 token checks out, it mints a **short-lived internal JWT**
     (≈90 seconds) signed with a shared secret.
   - This token includes an **`act` (actor)** claim that says:

     > “Service X is acting for User Y.”

   - That token is then attached to any internal service call as a new
     `Authorization: Bearer <internal-jwt>` header.

3. **Routing and Forwarding**
   - Based on the URL path, it forwards the request to the correct internal
     Worker:
     - `/api/pricing/*` → `svc-pricing`
     - `/api/valuation/*` → `svc-bond-valuation`
     - `/api/daycount/*` → `svc-daycount`

   - It uses **Cloudflare service bindings** for these calls, so everything
     stays on Cloudflare’s edge network (no external HTTP requests).

---

### 🔄 How the flow works

```text
(1)  User → Astro SPA
          |
          |  Auth0 SDK issues Access Token (OIDC)
          |
(2)  SPA → Gateway Worker
          |  Authorization: Bearer <auth0-access-token>
          v
     [Gateway verifies token with Auth0 JWKS]
          |
          |  if valid:
          |     mint internal JWT with act: { sub, perms, rid }
          |
(3)  Gateway → Internal Service (e.g. svc-pricing)
          |  Authorization: Bearer <internal-jwt>
          v
     [Service verifies internal token locally]
          |
          |  if valid:
          |     process request using user perms
          v
(4)  Service → Gateway → SPA
```

In short: **Auth0 handles who the user is.** **The Gateway handles who the
service is acting for.** **Each internal service trusts only signed tokens from
the Gateway.**

---

### 🔒 Why this design

- **Zero-trust** – Every hop verifies a cryptographic token.
- **Stateless** – No sessions or shared memory required.
- **Fast** – Tokens are tiny and validated locally.
- **Isolated** – Only the Gateway talks to Auth0; services never leave
  Cloudflare’s edge.
- **Auditable** – Each request carries a `rid` (request ID) and an `act` claim
  for traceability.

---

### 🧱 Key implementation details

| Component            | Responsibility                                                          |
| -------------------- | ----------------------------------------------------------------------- |
| **Auth0**            | Issues user access tokens (OIDC)                                        |
| **Gateway Worker**   | Verifies Auth0 tokens, mints internal JWTs, routes requests             |
| **Internal Workers** | Verify internal JWTs, enforce permissions, perform logic                |
| **Internal JWT**     | HMAC-signed, 60–120s TTL, includes `act` (actor) and `rid` (request ID) |
| **Service Bindings** | Keep internal calls private and fast across Cloudflare’s edge           |

---

### 🧩 Example claims inside an internal token

```json
{
  "iss": "https://gateway.bond-math",
  "sub": "svc-gateway",
  "aud": "svc-pricing",
  "exp": 1733444504,
  "rid": "0ad9e318-bd34-4a9a-bc86-30a1d35b54a9",
  "act": {
    "iss": "https://YOUR_AUTH0_DOMAIN/",
    "sub": "auth0|user123",
    "perms": ["pricing:read", "bond:price"]
  }
}
```

Each service validates this token locally and uses `act.sub` and `act.perms` to
decide what to allow.

---

### 🚧 Trade-offs

- We maintain one internal signing secret shared by all services (rotated as
  needed).
- Slightly more complexity at the gateway (minting logic).
- Services must verify internal tokens, but the code is only ~20 lines.

All of that’s worth it for clear, auditable trust boundaries between every
service.

---

### 📎 Outcome

The **Gateway Worker** is the security and routing backbone of _Bond Math_.

It turns the raw Auth0 user identity into a short-lived, internal trust token
that flows safely across services — keeping everything **stateless, secure, and
fast** at the edge.

It’s the piece that ties the Auth0 OIDC model to the zero-trust microservices
design.
