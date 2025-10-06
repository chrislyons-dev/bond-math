# Bond Math

[![CI](https://github.com/chrislyons-dev/bond-arch-as-code/actions/workflows/ci.yml/badge.svg)](https://github.com/chrislyons-dev/bond-arch-as-code/actions/workflows/ci.yml)
[![Deploy](https://github.com/chrislyons-dev/bond-arch-as-code/actions/workflows/deploy.yml/badge.svg)](https://github.com/chrislyons-dev/bond-arch-as-code/actions/workflows/deploy.yml)
[![Architecture Docs](https://github.com/chrislyons-dev/bond-arch-as-code/actions/workflows/arch-docs.yml/badge.svg)](https://chrislyons-dev.github.io/bond-arch-as-code/architecture)
![Cloudflare](https://img.shields.io/badge/Platform-Cloudflare-orange)
![Languages](https://img.shields.io/badge/Languages-Python_|_TypeScript_|_Java-blue)
![License](https://img.shields.io/badge/License-MIT-green)

**Content**

- [Bond Math](#bond-math)
  - [💡 Overview](#-overview)
  - [🔀 Routes](#-routes)
  - [🔐 Authentication \& Authorization](#-authentication--authorization)
  - [🗂️ Project Structure](#️-project-structure)
  - [🧱 Tech Stack](#-tech-stack)
  - [🧩 Microservices \& Routes](#-microservices--routes)
  - [🛠️ Development \& Deployment](#️-development--deployment)
  - [📚 Documentation](#-documentation)

---

### 💡 Overview

**Bond Math** is a multi-language, serverless microservices system for
fixed-income pricing and metrics, designed to demonstrate **Architecture as
Code** principles.  
It is deployed on **Cloudflare Pages** and **Workers** with **Cloudflare API
Gateway** in front.

This project is **not meant to be a production-ready bond metrics system**.  
It’s a **teaching and demonstration project** — showing how to use techniques
like:

- Architecture as Code (C4 + Structurizr + IaC metadata)
- Multi-language service boundaries
- Zero-trust authorization between Workers
- Automated documentation and CI/CD on Cloudflare

The focus is **on how it’s built**, not **what it computes**.

Each service is deployed independently as a **Cloudflare Worker** (or
Worker-based runtime) and communicates internally using **Service Bindings**.  
Documentation under `/docs/architecture` is automatically generated from code
annotations and IaC metadata, ensuring the diagrams always reflect the current
implementation.

Service split:

- **Python (Valuation)** – clean/dirty price ↔ yield routines + schedule
  generation
- **Python (Metrics)** – duration, convexity, and yield-curve metrics
- **TypeScript/Node (Day-Count)** – authoritative year-fraction conventions
  (ACT/360, 30E/360, ACT/365F, …)
- **TypeScript/Node (Gateway)** – authoritative year-fraction conventions
  (ACT/360, 30E/360, ACT/365F, …)
- **Java (Pricing Engine)** – discounting & PV of cashflows
- **Astro UI (Pages)** – user interface

**Routing & security:** Public API paths are exposed via **API Gateway + Workers
Routes**.  
**Service-to-service:** Workers talk to each other with **Service Bindings**
(stays on the Cloudflare network, no public hop).  
**Docs:** Automated **C4 diagrams** are generated from the source.

---

### 🔀 Routes

SPA: https://bondmath.chrislyons.dev (Cloudflare Pages)

API: https://bondmath.chrislyons.dev/api/* (Gateway Worker)

Internal services: reachable only via service bindings from the gateway

No CORS. Browser calls fetch('/api/...') and everything stays same-origin.

---

### 🔐 Authentication & Authorization

Bond Math uses a simple **zero-trust model** built on top of **Auth0** and
**short-lived internal JWTs**:

- **Auth0 (OIDC)** handles all user login for the Astro front end.
  - The SPA obtains an Auth0 access token using the standard SPA + API pattern.
  - API Gateway verifies this token against Auth0’s JWKS before forwarding
    requests.

- **Internal tokens with `act` (actor) claim**:
  - The Gateway (or first receiving service) mints a short-lived internal JWT
    (≈90 s TTL).
  - The token contains who the user is and which service is acting on their
    behalf.
  - Downstream services validate this token locally without re-contacting Auth0.

- **Result:**  
  Every internal hop is cryptographically verified.  
  Each service trusts **signatures**, not networks — simple, fast, and secure.

This setup keeps Auth0 isolated, reduces external calls, and is easy to
demonstrate in code and diagrams.

---

### 🗂️ Project Structure

. (root) # Top-level configuration files and metadata │ ├── docs/ #
Documentation and architecture assets │ ├── adr/ # Architecture Decision Records
(ADRs) │ └── architecture/ # C4 diagrams, PlantUML, Structurizr outputs │ └──
reference/ # component documentation │ ├── iac/ # Infrastructure as Code │ ├──
Makefile # Deployment automation (Terraform + Wrangler) │ ├── tf/ # Terraform
modules for Cloudflare config │ ├── workers/ # Wrangler config files for each
Worker │ └── wrangler.toml # Root Cloudflare Wrangler configuration │ ├──
services/ # Core microservices │ ├── metrics/ # Python – duration, convexity,
curve metrics │ ├── bond-valuation/ # Python – price ↔ yield and schedule
generation │ ├── daycount/ # TypeScript – day-count conventions API (Cloudflare
Worker) │ └── pricing/ # Java – discounting & present value engine │ ├──
tests/ # Test suites │ ├── integration/ # Cross-service and end-to-end tests │
└── load/ # Performance and load tests │ ├── ui/ # Astro frontend (Cloudflare
Pages) │ ├── LICENSE # MIT license └── README.md # Project overview and
documentation entry point

---

### 🧱 Tech Stack

| Layer                      | Technology                 | Description                                                                                                  |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Frontend (UI)**          | Astro (Cloudflare Pages)   | Input & visualization                                                                                        |
| **Public API Front Door**  | Cloudflare **API Gateway** | Auth (Auth0), rate limits, usage plans, and metrics                                                          |
| **Workers (per service)**  | Cloudflare Workers         | `/api/valuation`, `/api/metrics`, `/api/daycount`, `/api/pricing`                                            |
| **Bond Valuation**         | Python                     | Clean/dirty price ↔ yield + schedules (calls Day-Count via binding)                                         |
| **Metrics**                | Python                     | Duration, convexity, yield-curve metrics (calls Day-Count via binding)                                       |
| **Day-Count**              | TypeScript (Workers)       | Centralized date/day-count conventions API                                                                   |
| **Pricing Engine**         | Java                       | Discounting engine for projected cashflows. Calculate the present value of cashflows given a discount curve. |
| **Infrastructure as Code** | Terraform + Wrangler       | Config & deploy                                                                                              |
| **Architecture as Code**   | PlantUML + Structurizr     | Auto-generated C4 diagrams                                                                                   |
| **CI/CD**                  | GitHub Actions             | Build, test, deploy, docs                                                                                    |

- Each service runs as a **Cloudflare Worker** and communicates using **Service
  Bindings**.
- Auth, identity, and internal tokens follow a consistent zero-trust pattern
  described in [ADR 0004](./docs/adr/0004-identity-provider-auth0.md) and
  [ADR 0005](./docs/adr/0005-zero-trust-authorization.md).

---

### 🧩 Microservices & Routes

| Path               | Worker           | Language   | Purpose                     |
| ------------------ | ---------------- | ---------- | --------------------------- |
| `/api/valuation/*` | `bond-valuation` | Python     | Price ↔ yield & schedules  |
| `/api/metrics/*`   | `metrics`        | Python     | Duration, convexity, curves |
| `/api/daycount/*`  | `daycount`       | TypeScript | Year-fraction & conventions |
| `/api/pricing/*`   | `pricing-engine` | Java       | Discounting / PV            |

**API Gateway** protects these routes using **Auth0** for external identity
verification and enforces **rate-limits, quotas, and usage metrics**. **Service
Bindings** allow the internal services to call each other securely using
short-lived internal tokens described above.

---

### 🛠️ Development & Deployment

**Root `Makefile`** – Developer workflows:

```bash
make install          # Install all dependencies
make format           # Format code with Prettier
make lint             # Lint all code
make test             # Run all tests
make build            # Build all services
```

**`iac/Makefile`** – Infrastructure & deployment:

```bash
make tf-init          # Initialize Terraform
make tf-plan          # Plan infrastructure changes
make deploy           # Full deployment (Terraform → Wrangler)
make wrangler-dev-gateway   # Start Gateway in local dev mode
make tail-gateway     # Stream Worker logs
```

See [contributing.md](./contributing.md) for commit standards and workflow
details.
