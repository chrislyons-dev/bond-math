# ADR 0011 – Symmetric JWT (HS256) for Internal Service Authentication

**Status:** Accepted **Date:** 2025-10-06 **Context:** Choosing between
symmetric (HMAC-SHA256) and asymmetric (RSA-SHA256) cryptography for internal
JWT signing and verification in _Bond Math_.

---

### 🧩 What we were deciding

Building on ADR 0005 (zero-trust authorization) and ADR 0006 (Gateway Worker
design), I needed to decide **how to cryptographically sign and verify** the
internal JWTs that flow between services.

The Gateway Worker mints short-lived tokens for each request. Every downstream
service (DayCount, Valuation, Pricing, Metrics) must verify these tokens to
enforce zero-trust.

The question was: **Which signing algorithm should we use?**

- **HS256** (HMAC with SHA-256) – symmetric key cryptography
- **RS256** (RSA with SHA-256) – asymmetric key cryptography

This is the same choice Auth0 and other identity providers face, but our context
is different: _internal service-to-service communication within a trusted
deployment_.

---

### ⚖️ The options

| Option                     | Description                                                                 | Pros                                                                                                                                  | Cons                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **1️⃣ HS256 (HMAC-SHA256)** | Symmetric algorithm using a shared secret for both signing and verification | **Fast** (~0.1ms/op), **simple** (one secret), **small tokens**, perfect for trusted service meshes                                   | Shared secret means any service can mint tokens; key rotation requires coordination                                |
| **2️⃣ RS256 (RSA-SHA256)**  | Asymmetric algorithm using a private key to sign and public key to verify   | **Better isolation** (only Gateway can mint), **easy key rotation** (publish new public key), **industry standard** for external IdPs | **10-100x slower** (~1-2ms/op), **more complex** (key pairs, JWKS endpoint), **larger tokens** (need `kid` header) |
| **3️⃣ EdDSA (Ed25519)**     | Modern asymmetric algorithm using elliptic curve cryptography               | Faster than RSA, smaller keys                                                                                                         | Not as widely supported in Web Crypto API; less familiar to most developers                                        |

---

### ✅ Decision

Use **HS256 (HMAC-SHA256)** for internal JWT signing and verification.

All services will share the same `INTERNAL_JWT_SECRET` (minimum 32 bytes),
stored securely via Wrangler's secret management:

- **Gateway:** Signs tokens using the secret
- **All services:** Verify tokens using the same secret

Each service validates:

1. HMAC signature is valid
2. Expiration (`exp`) has not passed
3. Audience (`aud`) matches the service identifier
4. Actor claim (`act`) is present and valid

---

### 💬 Why this makes sense for _Bond Math_

#### **Performance**

- **10-100x faster** than RSA verification
- HMAC verification: ~0.1ms per request
- Critical for edge Workers with CPU limits
- Lower latency = better user experience

#### **Simplicity**

- **One secret** instead of managing key pairs
- **Less code** (~50 lines vs ~150 lines for RSA)
- **Smaller tokens** (no `kid` header needed)
- **No JWKS endpoint** required

#### **Trusted Environment**

- All services are **owned and operated by the same team**
- All run on **Cloudflare's infrastructure** (trusted platform)
- **Service Bindings** ensure services can't be called externally
- If any service is compromised, the entire deployment is compromised anyway
  (shared trust boundary)

#### **Industry Precedent**

- **Kubernetes uses symmetric secrets** for service accounts
- **Istio uses symmetric keys** for internal mTLS
- **Netflix uses symmetric HMAC** for internal service auth
- Asymmetric crypto is for **cross-boundary trust**, not internal meshes

#### **Short TTL Limits Damage**

- Tokens expire in 90 seconds
- Even if a service is compromised, attacker has limited window
- Short TTL + secret rotation = minimal blast radius

---

### 🚧 Trade-offs we accept

#### **Shared Secret Means Shared Trust**

Any service with the secret can mint tokens for any other service. This is
acceptable because:

- All services are trusted (we wrote them all)
- Service Bindings prevent external access
- If one service is compromised, we have bigger problems than token minting
- We can detect and rotate secrets quickly

#### **Key Rotation Requires Coordination**

Unlike RS256 where services can fetch new public keys automatically, HS256
rotation requires:

- Updating secret in all services simultaneously
- Brief window where old tokens fail during cutover
- **Mitigation:** Use dual-secret verification during rotation (accept old OR
  new for 2 minutes)

#### **Cannot Distinguish Minter**

With symmetric keys, any service could theoretically mint tokens. We accept this
because:

- Service Bindings enforce network-level isolation
- Logging and request IDs provide audit trail
- Internal services don't have reason or ability to mint tokens (no Auth0 claims
  to act upon)

---

### 🔐 Security Considerations

#### **Secret Storage**

- **Production:** Stored using **Wrangler secrets** (encrypted at rest by
  Cloudflare)
- **Local Development:** Stored in `.dev.vars` file (gitignored)
- **No abstraction needed:** Cloudflare Workers handle local vs production
  seamlessly via `env` parameter
- Never in code, config files (except `.dev.vars`), or version control
- Different secrets per environment (dev, preview, production)
- Minimum 32 bytes (256 bits) for HMAC-SHA256 security

See [Authentication Reference](../reference/authentication.md) for setup
instructions.

#### **Secret Rotation Policy**

- Rotate every **90 days** (quarterly)
- Immediate rotation if compromise suspected
- Use dual-verification during rotation (accept both old and new for 90 seconds)

#### **Token Properties**

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
{
  "iss": "https://gateway.bond-math",
  "sub": "svc-gateway",
  "aud": "svc-daycount",
  "exp": 1733444504,
  "rid": "a1b2c3d4-...",
  "act": {
    "iss": "https://tenant.auth0.com/",
    "sub": "auth0|user123",
    "perms": ["daycount:read"]
  }
}
```

#### **Verification Requirements**

Each service MUST validate:

- ✅ Signature matches (HMAC-SHA256)
- ✅ Audience (`aud`) matches service identifier
- ✅ Not expired (`exp > now`)
- ✅ Actor claim present (`act.sub` exists)
- ✅ Issuer is Gateway (`iss === "https://gateway.bond-math"`)

---

### 🔄 When to Reconsider RS256

We should revisit this decision if:

#### **Third-Party Verification**

If external services need to verify our internal tokens (e.g., partner
integrations), RS256 would let us publish a public key without exposing signing
ability.

#### **Untrusted Services**

If we add community plugins or allow third-party Workers to call our services,
asymmetric keys would prevent them from minting tokens.

#### **Compliance Requirements**

If PCI-DSS Level 1 or similar regulations mandate asymmetric cryptography for
service-to-service auth.

#### **High-Frequency Key Rotation**

If we need to rotate keys daily or hourly, RS256's automatic public key fetching
would be easier.

#### **Performance is Not Critical**

If our services operate at < 100 req/sec where the 10x verification slowdown
doesn't matter.

---

### 📎 Outcome

_Bond Math_ uses **HS256 (HMAC-SHA256)** for internal JWT authentication
because:

✅ It's **10-100x faster** than asymmetric alternatives ✅ It's **simpler** to
implement and maintain ✅ It's **industry standard** for trusted service meshes
✅ It's **perfectly secure** for our trust model (all services owned by us) ✅
It **reduces latency and cost** on Cloudflare Workers

This decision aligns with the project's goals of **clarity, performance, and
appropriate security** — using the right tool for the job rather than blindly
following patterns meant for different contexts (like third-party identity
providers).

The architecture remains **zero-trust** (every hop verifies signatures) while
being **pragmatic** about the cryptographic mechanisms used within a trusted
boundary.

---

### 📚 References

**Bond Math Documentation:**

- [ADR 0005: Zero-Trust Authorization](./0005-zero-trust-authorization.md)
- [ADR 0006: Gateway Worker Design](./0006-gateway-worker.md)
- [ADR-0012: Scope-Based Authorization](./0012-scope-based-authorization.md)
- [Authentication Reference](../reference/authentication.md) - Setup and
  configuration

**External Standards:**

- [RFC 7519 - JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- [RFC 2104 - HMAC](https://datatracker.ietf.org/doc/html/rfc2104)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Cloudflare Web Crypto API](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)

---

### 🔀 Alternative Considered: RS256 (Asymmetric Keys)

**Rejected** because our services form a trusted mesh - all services are under
our control and share a common trust boundary. RS256 adds complexity (key
rotation, distribution) without security benefit in this architecture. If
requirements change (third-party verification, compliance mandates), we can
migrate to RS256 as a breaking change.
