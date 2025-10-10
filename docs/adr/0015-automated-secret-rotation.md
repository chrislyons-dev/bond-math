# ADR 0015 – Automated JWT Secret Rotation with Zero-Downtime Deployment

**Status:** Accepted **Date:** 2025-10-10 **Context:** Implementing automated
rotation of the internal JWT secret on every deployment while maintaining
zero-downtime service availability.

---

### 🧩 What we were deciding

Building on ADR 0011 (Symmetric JWT for Internal Auth), we established that all
services share a single `INTERNAL_JWT_SECRET` for HMAC-SHA256 token signing and
verification. However, ADR 0011 identified a key challenge:

> **Key Rotation Requires Coordination** – Unlike RS256 where services can fetch
> new public keys automatically, HS256 rotation requires updating the secret in
> all services simultaneously, with a brief window where old tokens fail during
> cutover.

The question was: **How do we rotate the shared secret without causing
authentication failures during deployment?**

This decision impacts:

- **Security posture** – Frequency and automation of secret rotation
- **Deployment reliability** – Preventing downtime during secret changes
- **Operational complexity** – Manual vs automated rotation processes
- **Developer experience** – Transparency of rotation mechanism

---

### ⚖️ The options

| Option                           | Description                                                         | Pros                                                                       | Cons                                                                                     |
| -------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **1️⃣ Manual Quarterly Rotation** | Rotate secret manually every 90 days using `wrangler secret put`    | **Simple**, minimal CI/CD changes                                          | Manual process prone to errors; coordination window still exists; infrequent rotation    |
| **2️⃣ Blue-Green Deployment**     | Deploy new version with new secret, swap traffic via DNS/routing    | Clean cutover, full rollback capability                                    | Requires double infrastructure cost; complex for 5 services; overkill for secret change  |
| **3️⃣ Dual-Secret Verification**  | Services accept both CURRENT and PREVIOUS secrets during transition | **Zero-downtime**, automated rotation on every deploy, simple to implement | Slightly more complex verification logic; 2 secrets stored per service                   |
| **4️⃣ External Secret Manager**   | Use Vault/AWS Secrets Manager with auto-rotation                    | Centralized management, audit trail                                        | External dependency; vendor lock-in; adds latency; cost; complexity                      |
| **5️⃣ Rolling Deployment**        | Deploy services one-by-one with new secret                          | No dual-secret needed                                                      | Long coordination window (5 deploys); authentication failures during rollout             |
| **6️⃣ RS256 Migration**           | Switch to asymmetric keys where rotation is easier                  | Easier rotation (just publish new public key)                              | 10-100x slower verification; ADR 0011 rejected this for performance reasons              |
| **7️⃣ Stale Secret Tolerance**    | Accept tokens signed with any secret in last 90 days                | Very flexible                                                              | Security risk – old compromised secrets remain valid too long                            |
| **8️⃣ No Rotation**               | Never rotate the secret                                             | Simplest possible approach                                                 | Security anti-pattern; violates least-privilege principle; fails compliance              |
| **9️⃣ JWT Refresh Window**        | Stop accepting requests during rotation                             | Simple logic                                                               | Downtime = unacceptable for production                                                   |
| **🔟 Multi-Version Secrets**     | Services verify against N previous secrets (e.g., last 5)           | Very flexible, supports frequent rotation                                  | Complexity grows with N; more secrets to manage; security risk if old secret compromised |

---

### ✅ Decision

Use **Dual-Secret Verification (#3)** with **automated rotation on every
deployment**.

#### Implementation Strategy

**Environment Variables (per service):**

- `INTERNAL_JWT_SECRET_CURRENT` – Active secret used for signing
- `INTERNAL_JWT_SECRET_PREVIOUS` – Previous secret accepted for verification
  only

**CD Pipeline Flow:**

1. **Generate New Secret** – Create cryptographically secure 64-character secret
2. **Fetch Current** – Retrieve existing `INTERNAL_JWT_SECRET_CURRENT` from
   Cloudflare
3. **Set Dual Secrets** – On all 5 workers:
   - `INTERNAL_JWT_SECRET_CURRENT` = NEW
   - `INTERNAL_JWT_SECRET_PREVIOUS` = OLD
4. **Deploy All Workers** – TypeScript (gateway, daycount) + Python (valuation,
   metrics, pricing)
5. **Zero-Downtime** – All workers accept both secrets during transition

**Verification Logic:**

```python
# Python (microapi)
def _verify_token(self, token):
    signature_valid = verify_signature(token, self.secret)
    if not signature_valid and self.previous_secret:
        signature_valid = verify_signature(token, self.previous_secret)
    if not signature_valid:
        raise ValueError("Invalid token signature")
```

```typescript
// TypeScript (gateway, daycount)
let isValid = await verifySignature(data, signature, secret);
if (!isValid && previousSecret) {
  isValid = await verifySignature(data, signature, previousSecret);
}
```

**Backward Compatibility:**

- Services fallback to `INTERNAL_JWT_SECRET` if `*_CURRENT` not set
- Enables gradual migration from single-secret to dual-secret model
- No breaking changes to existing deployments

---

### 💬 Why this makes sense for _Bond Math_

#### **Security: Rotation on Every Deployment**

- Secret rotated automatically with every `main` branch push
- Typical rotation frequency: **days to weeks** (vs 90 days manual)
- Compromised secret has limited lifetime
- No human error in rotation process
- Cryptographically secure secret generation (OpenSSL)

#### **Reliability: True Zero-Downtime**

- **No synchronization window** – all services deployed with both secrets
- Gateway mints with CURRENT, services accept CURRENT or PREVIOUS
- JWTs signed with old secret remain valid during deployment
- New JWTs use new secret immediately after Gateway deploys
- Atomic from user perspective – no authentication failures

#### **Simplicity: Minimal Code Changes**

- **Python services:** ~20 lines added to `JWTMiddleware`
- **TypeScript services:** ~10 lines added to verification functions
- **No changes to business logic** – all services use `create_worker_app()`
- Automatic via helper functions – developers don't think about rotation

#### **Automation: Fully Integrated with CI/CD**

- **One workflow** handles secret generation, distribution, and deployment
- Secrets masked in GitHub Actions logs
- Concurrency control prevents parallel deployments
- Deployment fails if rotation fails (fail-fast principle)
- Manual trigger available for emergency rotations

#### **Cost: No Infrastructure Overhead**

- Uses Cloudflare's built-in secret storage (free)
- No external secret managers or additional services
- No double infrastructure for blue-green
- Negligible CPU overhead for dual-verification (~0.1ms worst case)

#### **Auditability: Full Deployment Trail**

- GitHub Actions logs every rotation (secrets masked)
- Cloudflare audit logs track secret updates
- Deployment summary shows rotation status
- Request IDs enable token tracing

---

### 🚧 Trade-offs we accept

#### **Two Secrets Per Service (Temporary)**

During deployment window, services store 2 secrets instead of 1. This is
acceptable because:

- **Temporary state** – after all services deploy, old secret becomes irrelevant
- **Minimal overhead** – 64 bytes × 2 = 128 bytes per worker (negligible)
- **Security benefit** – enables zero-downtime rotation
- **Industry standard** – Kubernetes uses similar "dual-credential" pattern

#### **Rotation on Every Deploy (Not Time-Based)**

Secrets rotate with deployments, not on a fixed schedule (e.g., every 30 days).
This is acceptable because:

- **More frequent = better** – typical rotation every few days vs 90 days
- **Tied to code changes** – new secret with new code reduces correlation
- **Emergency rotation available** – manual workflow dispatch for immediate
  rotation
- **Compliance satisfied** – most standards require quarterly rotation (we
  exceed this)

#### **Deployment Coupling**

Secret rotation is coupled to full deployment (all 5 workers). This is
acceptable because:

- **Deployment is fast** – 5-10 minutes for all workers
- **Already atomic** – we deploy all workers together anyway
- **Reduces complexity** – no separate rotation process to maintain
- **Safe rollback** – if deployment fails, old secret remains active

#### **Previous Secret Lifetime**

`INTERNAL_JWT_SECRET_PREVIOUS` remains valid until next deployment. This is
acceptable because:

- **Time-bounded** – only valid during deployment window (minutes)
- **Short JWT TTL** – tokens expire in 90 seconds anyway
- **Monitoring available** – can detect if old secret is being used excessively
- **Better than alternatives** – downtime or manual rotation would be worse

---

### 🔐 Security Considerations

#### **Secret Generation**

- **OpenSSL** used for cryptographically secure randomness
- **64 characters** (384 bits) base64-encoded
- **Unique per deployment** – no secret reuse
- **Masked in logs** – GitHub Actions `::add-mask::` prevents exposure

#### **Secret Storage**

- **Cloudflare Secrets** – encrypted at rest by Cloudflare
- **GitHub Actions** – secrets never stored, only passed ephemerally
- **No local storage** – rotation happens entirely in CI/CD
- **Different per environment** – production, staging, development isolated

#### **Secret Distribution**

- **Parallel deployment** – all 5 workers get secrets simultaneously
- **Atomic from Cloudflare perspective** – workers can't deploy with mismatched
  secrets
- **Matrix strategy** – GitHub Actions deploys services in parallel
- **Rollback safe** – if any service fails, deployment stops

#### **Verification Security**

- **Constant-time comparison** – `hmac.compare_digest()` prevents timing attacks
- **Same validation** – both CURRENT and PREVIOUS use identical verification
  logic
- **No weakening** – dual-secret doesn't reduce cryptographic strength
- **Audit trail** – can log which secret verified (for debugging)

#### **Failure Modes**

| Failure Scenario                          | Impact                                                        | Mitigation                                                              |
| ----------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Secret generation fails                   | Deployment aborted, old secret remains                        | OpenSSL is reliable; if fails, check CI environment                     |
| Fetch current secret fails (first deploy) | Use new secret for both CURRENT and PREVIOUS (bootstrap mode) | Safe – all workers get same secret                                      |
| Set secret fails on 1 service             | Deployment fails fast, rollback                               | Matrix strategy retries; manual `wrangler secret put` as backup         |
| Deploy fails after secrets set            | Services have new secrets but old code                        | Old code uses `INTERNAL_JWT_SECRET` fallback (backward compatible)      |
| Concurrent deployments                    | Prevented by concurrency control                              | `concurrency.cancel-in-progress: false` ensures sequential deployments  |
| Secret exposed in logs                    | GitHub Actions masks secrets                                  | `::add-mask::` on all secret values; review logs before making public   |
| Old secret compromised                    | Valid for ~5-10 minutes (deployment window)                   | Short TTL limits damage; can abort deployment and re-rotate immediately |

---

### 🔄 When to Reconsider

We should revisit this decision if:

#### **Multi-Region Deployment**

If we deploy to multiple Cloudflare regions with separate worker pools,
dual-secret verification may need extension to support N regions.

#### **High-Frequency Deployments (>10/day)**

If we deploy many times per day, rotation frequency might become excessive.
Consider time-based rotation (e.g., max once per hour).

#### **Compliance Mandates Fixed Schedule**

If regulations require rotation on specific days (e.g., first of month), add
scheduled workflow trigger.

#### **Secret Compromise Detection**

If we detect active use of PREVIOUS secret after deployment completes, may
indicate replay attack or misconfigured service.

#### **External Secret Manager Requirement**

If organizational policy mandates centralized secret management (e.g., HashiCorp
Vault), this approach would need adjustment.

#### **Performance Regression**

If dual-verification adds measurable latency (>1ms), consider optimizing or
reverting to single-secret with downtime.

---

### 📎 Outcome

_Bond Math_ implements **dual-secret JWT verification with automated rotation on
every deployment** because:

✅ **Zero-downtime** – No authentication failures during deployment ✅
**Automated** – No manual secret management or coordination ✅ **Secure** –
Secrets rotated frequently (days vs 90 days) ✅ **Simple** – Minimal code
changes, integrated with CI/CD ✅ **Production-ready** – Demonstrates real-world
DevSecOps pattern ✅ **Cost-effective** – No external dependencies or
infrastructure ✅ **Auditable** – Full deployment trail in GitHub Actions

This decision extends ADR 0011's symmetric JWT choice with a practical rotation
strategy that **maintains zero-trust security** while **eliminating operational
burden** and **ensuring continuous availability**.

The implementation demonstrates an **architecture as teaching tool** – showing
how to solve real-world secret rotation challenges in a serverless, distributed
system.

---

### 📚 References

**Bond Math Documentation:**

- [ADR 0011: Symmetric JWT for Internal Auth](./0011-symmetric-jwt-for-internal-auth.md)
  – Establishes HS256 choice and rotation challenge
- [ADR 0009: Deployment Approach](./0009-deployment-approach.md) – Cloudflare
  Workers deployment model
- [GitHub Actions CD Workflow](../../.github/workflows/cd.yml) – Implementation
  of rotation pipeline

**External Standards:**

- [NIST SP 800-57: Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
  – Key rotation best practices
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
  – Platform secret management
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
  – CI/CD secret handling

**Industry Patterns:**

- [Kubernetes Secret Rotation](https://kubernetes.io/docs/concepts/configuration/secret/#secret-rotation)
  – Dual-credential pattern
- [Istio Certificate Rotation](https://istio.io/latest/docs/tasks/security/cert-management/plugin-ca-cert/)
  – Zero-downtime rotation in service mesh
- [Netflix Security Automation](https://netflixtechblog.com/netflix-security-monkey-on-guard-for-deployments-1f6fc9db99d1)
  – Automated secret management

---

### 🔀 Alternatives Considered

#### Manual Quarterly Rotation (#1)

**Rejected** because manual processes are error-prone and don't scale.
Automation is fundamental to DevOps and security hygiene. Quarterly rotation is
insufficient for modern threat models.

#### Blue-Green Deployment (#2)

**Rejected** because infrastructure cost doubles and complexity is overkill for
secret rotation. Blue-green makes sense for major version migrations, not
routine deployments.

#### External Secret Manager (#4)

**Rejected** because adds external dependency, latency, and cost without
significant benefit. Cloudflare's built-in secret management is sufficient for
our trust model.

#### Rolling Deployment (#5)

**Rejected** because creates long synchronization window where some services
have new secret and others have old, causing authentication failures.

#### RS256 Migration (#6)

**Rejected** per ADR 0011 – asymmetric crypto is 10-100x slower for verification
without security benefit in our trusted service mesh.

#### No Rotation (#8)

**Rejected** as security anti-pattern. Static secrets violate defense-in-depth
and fail compliance requirements.
