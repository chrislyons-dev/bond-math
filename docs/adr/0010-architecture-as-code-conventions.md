# ADR 0010 – Architecture as Code Documentation Conventions

**Status:** Accepted
**Date:** 2025-10-05
**Context:** Establishing standards for embedding architectural metadata in code to enable automated diagram generation.

---

### 🧩 What we were deciding

How to annotate code, IaC, and service definitions so that **Architecture as Code** tooling can extract metadata and generate accurate C4 diagrams, service maps, and dependency graphs.

We need conventions that:
- Work across Python, TypeScript, and Java
- Don't clutter the code with noise
- Are machine-parseable and human-readable
- Integrate with existing tooling (PlantUML, Structurizr, Terraform)

---

### ✅ Decision

Adopt a **structured comment-based annotation system** using standardized tags.

---

## 📝 Annotation Standards

### **Service-Level Metadata**

Every service must have a metadata block at the top of its main entry point:

```typescript
/**
 * @service gateway
 * @type cloudflare-worker
 * @layer api-gateway
 * @description Entry point for all API requests. Handles Auth0 verification and mints internal JWTs.
 * @owner platform-team
 * @public-routes /api/*
 * @dependencies auth0, svc-pricing, svc-valuation, svc-daycount
 */
```

#### Required Tags:
- `@service` – unique service identifier (kebab-case)
- `@type` – deployment type (cloudflare-worker | cloudflare-pages | lambda | etc.)
- `@layer` – architectural layer (ui | api-gateway | business-logic | data-access)
- `@description` – one-line purpose statement

#### Optional Tags:
- `@owner` – team or individual responsible
- `@public-routes` – externally accessible paths
- `@internal-routes` – service-binding-only paths
- `@dependencies` – comma-separated list of services/external systems
- `@security-model` – auth method (auth0-oidc | internal-jwt | api-key | none)
- `@sla-tier` – criticality (critical | high | medium | low)

---

### **API Endpoint Metadata**

For each public or internal endpoint:

```typescript
/**
 * @endpoint POST /api/daycount/v1/count
 * @authentication internal-jwt
 * @scope daycount:read
 * @rate-limit 100/min
 * @cacheable true
 * @cache-ttl 3600
 * @description Calculates year fractions and accrual days for multiple date pairs
 */
export async function handleCount(request: Request): Promise<Response> {
  // ...
}
```

#### Endpoint Tags:
- `@endpoint` – HTTP method + path
- `@authentication` – required auth type
- `@scope` – required permission(s)
- `@rate-limit` – throttling policy
- `@cacheable` – whether responses can be cached
- `@cache-ttl` – cache time-to-live in seconds
- `@calls` – downstream services this endpoint invokes

---

### **Service Binding Metadata**

Document service-to-service calls:

```typescript
/**
 * @service-binding SVC_DAYCOUNT
 * @target daycount
 * @purpose Calculate year fractions for bond valuation
 * @fallback local-stub
 */
const daycountClient = env.SVC_DAYCOUNT;
```

---

### **Infrastructure as Code Metadata**

In Terraform files, use consistent naming and outputs:

```hcl
# @cloudflare-worker gateway
# @public-route bondmath.chrislyons.dev/api/*
# @service-bindings svc-pricing, svc-valuation, svc-daycount
resource "cloudflare_worker_script" "gateway" {
  name    = "gateway"
  content = file("${path.module}/../../services/gateway/dist/index.js")

  # ... bindings, secrets, etc.
}
```

---

### **Dependency Graph Metadata**

Use structured comments for inter-service dependencies:

```python
"""
@service bond-valuation
@calls daycount:year-fraction
@called-by gateway, metrics
"""
```

---

## 🔍 Extraction and Generation

### **Tooling**
- **Custom parser script** (`scripts/extract-arch-metadata.py`) scans all services for annotations
- Outputs JSON schema: `docs/architecture/metadata.json`
- **PlantUML generator** (`scripts/generate-c4.py`) reads JSON and produces C4 diagrams
- **Structurizr DSL generator** (optional) for richer modeling

### **CI Integration**
GitHub Actions workflow runs on every push to `main`:
1. Extract metadata from all services
2. Generate C4 diagrams (Context, Container, Component)
3. Generate service dependency graph
4. Publish to `docs/architecture/`
5. Deploy to GitHub Pages at `https://chrislyons-dev.github.io/bond-math/architecture`

---

## 📐 Diagram Standards

### **C4 Model Levels**
1. **Context Diagram** – Bond Math system + external systems (Auth0, Cloudflare)
2. **Container Diagram** – All Workers, Pages, API Gateway
3. **Component Diagrams** – Internal structure of each Worker (per service)

### **Naming Conventions**
- Diagrams: `c4-{level}-{scope}.puml` (e.g., `c4-container-bond-math.puml`)
- Generated PNGs: `c4-{level}-{scope}.png`
- Keep source `.puml` files in `docs/architecture/diagrams/`
- Generated images in `docs/architecture/generated/`

---

## 📁 File Organization

```
docs/
├── adr/                              # Architecture Decision Records
├── architecture/
│   ├── diagrams/
│   │   ├── c4-context.puml          # Manually maintained or generated
│   │   ├── c4-container.puml
│   │   └── components/
│   │       ├── gateway.puml
│   │       ├── daycount.puml
│   │       └── ...
│   ├── generated/                    # Auto-generated outputs (gitignored or committed)
│   │   ├── c4-context.png
│   │   ├── c4-container.png
│   │   ├── dependency-graph.dot
│   │   └── metadata.json
│   └── README.md                     # Architecture overview and diagram index
└── reference/                        # Service-specific documentation
    ├── gateway.md
    ├── daycount.md
    └── ...
```

---

## 🧪 Validation

Every PR must pass:
- **Metadata linting**: All services have required `@service`, `@type`, `@layer`, `@description` tags
- **Dependency validation**: All `@dependencies` and `@calls` references resolve to actual services
- **Diagram generation**: PlantUML successfully renders all diagrams without errors

CI fails if:
- Service is missing metadata block
- Referenced service doesn't exist
- Diagram generation fails

---

## 💬 Notes

- Annotations should be **concise and accurate** – treat them as code, not prose
- Update annotations **in the same PR** that changes behavior
- If you add a new service, add a new component diagram
- If you change a dependency, update `@calls` and `@dependencies`
- Run `make arch-docs` locally before pushing to catch issues early

---

## 📎 Outcome

With these conventions:
- Architecture diagrams **never lie** because they're generated from actual code
- Developers see the metadata while reading/editing code
- CI enforces consistency automatically
- Onboarding is faster – new developers can trust the diagrams
- Refactoring becomes safer – dependency changes are tracked

This is the foundation of **Architecture as Code** for _Bond Math_.
