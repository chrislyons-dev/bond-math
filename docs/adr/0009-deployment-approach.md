# ADR 0009 – Hybrid Deployment with Terraform and Wrangler

**Status:** Accepted **Date:** 2025-10-05 **Context:** Deciding how to
coordinate _Bond Math_ deployments between Terraform (infrastructure) and
Wrangler (application code).

---

### 🧩 What we were deciding

_Bond Math_ uses both **Terraform** and **Cloudflare Wrangler**:

- **Terraform** already provisions DNS records, Pages projects, and other
  infrastructure pieces.
- **Wrangler** is purpose-built for building and deploying Workers and binding
  services.

I needed to decide **which tool owns what**, so there’s a clear line between
_infrastructure provisioning_ and _application deployment_.

---

### ⚖️ The options

| Option                                | Description                                                      | Pros                                                   | Cons                                              |
| ------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| **A – Hybrid (Terraform + Wrangler)** | Terraform manages DNS/Pages, Wrangler deploys Workers and routes | Simple, fast deploys; each tool does what it’s good at | Two steps in pipeline; coordination required      |
| **B – All Terraform**                 | Terraform owns DNS and Worker routes/scripts                     | One control plane                                      | Terraform’s Worker UX is awkward; slower feedback |
| **C – All Wrangler**                  | Wrangler also sets up DNS/Pages                                  | Easiest for tiny projects                              | Doesn’t scale if infra grows (no IaC audit trail) |

---

### ✅ Decision

Adopt **Option A – Hybrid Deployment**.

- **Terraform** manages **infrastructure**:
  - DNS records (e.g., `bondmath.chrislyons.dev`)
  - Pages project and custom domain
  - Any future KV, Durable Objects, or certificates

- **Wrangler** handles **application deployment**:
  - Building and publishing Workers
  - Attaching `/api/*` routes
  - Defining service bindings between Workers

In CI/CD, Terraform runs first to ensure DNS and Pages exist, then Wrangler
deploys the gateway and services.

---

### 💬 Why this makes sense for _Bond Math_

- **Wrangler** is optimized for bundling and pushing Workers; it’s fast and
  developer-friendly.
- **Terraform** keeps the rest of the system declarative and version-controlled.
- **Clear ownership:** Terraform = infra, Wrangler = app.
- Simplifies GitHub Actions: one workflow runs `terraform apply` →
  `wrangler deploy`.
- Keeps everything consistent inside `/iac` while staying tool-agnostic for
  future migrations.

---

### 🚧 Trade-offs we accept

- Two steps instead of one, so the CI workflow must enforce order.
- If a route is ever changed manually in the Cloudflare UI, it could drift from
  code.
- Requires the same **Cloudflare API token** and **account ID** to be shared
  between both tools (managed through GitHub Secrets).

Those are easy trade-offs for the clarity and speed we get.

---

### 🧰 Implementation summary

- **Terraform:** `/iac/tf`
  - Owns DNS, Pages project, custom domain, base resources.

- **Wrangler:** `/iac/workers`
  - Owns Worker source, routes (`/api/*`), and service bindings.

- **Pipeline order:**
  1. `terraform apply`
  2. `wrangler deploy --config gateway.toml`
  3. `wrangler deploy --config <service>.toml` (for each service)

---

### 📎 Outcome

_Bond Math_ now deploys with a clear, maintainable split:

| Layer                        | Owner     | Tool                 |
| ---------------------------- | --------- | -------------------- |
| DNS / Pages / Infra          | Terraform | IaC (Terraform)      |
| Workers / Routing / Bindings | Wrangler  | IaC (as-code deploy) |

This **Hybrid Terraform + Wrangler** approach keeps deployments fast,
reproducible, and auditable — exactly what _Bond Math_ needs to stay simple,
stateless, and fully defined as code.

---

**See also:**

- [ADR 0004 – Auth0 as Identity Provider](./0004-identity-provider-auth0.md)
- [ADR 0006 – Gateway Worker Design](./0006-gateway-worker.md)
- [ADR 0008 – Same-Origin Routing](./0008-same-origin-routing.md)
