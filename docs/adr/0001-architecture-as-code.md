# ADR 0001 – Architecture as Code

**Status:** Accepted **Date:** 2025-10-05 **Context:** Project uses multiple
languages and Cloudflare microservices.

---

## 🧩 What we were deciding

How to describe and maintain architecture for a system that's constantly
changing across multiple languages (TypeScript, Python, Java) and deployment
platforms.

**Options:**

1. **Manual diagrams** – Draw in Lucidchart/Miro, hope they stay current
2. **Separate modeling tool** – Structurizr/C4 Studio, maintain models apart
   from code
3. **Architecture as Code** – Generate diagrams from source code, config, and
   IaC

---

## ✅ Decision

Adopt **Architecture as Code** with structured comment-based annotations.

**Approach:**

- Diagrams generated from PlantUML/Structurizr files in repo
- Metadata extracted from code annotations and IaC
- GitHub Actions regenerate diagrams on every commit to `main`
- Generated diagrams live under `/docs/architecture`

**Goal:** Useful, honest documentation that's always accurate.

---

## 📝 Annotation Standards

### Service-Level Metadata

Every service must have a metadata block at entry point:

```typescript
/**
 * @service gateway
 * @type cloudflare-worker
 * @layer api-gateway
 * @description Entry point for all API requests
 * @owner platform-team
 * @public-routes /api/*
 * @dependencies svc-daycount, svc-valuation
 * @security-model auth0-oidc
 * @sla-tier critical
 */
```

**Required Tags:**

- `@service` – unique identifier (kebab-case)
- `@type` – deployment type (cloudflare-worker | lambda | etc.)
- `@layer` – architectural layer (ui | api-gateway | business-logic |
  data-access)
- `@description` – one-line purpose

**Optional Tags:**

- `@owner`, `@public-routes`, `@internal-routes`, `@dependencies`
- `@security-model`, `@sla-tier`

### Endpoint Metadata

```typescript
/**
 * @endpoint POST /count
 * @gateway-route POST /api/daycount/v1/count
 * @authentication internal-jwt
 * @scope daycount:write
 * @rate-limit 100/min
 * @cacheable true
 * @cache-ttl 3600
 */
```

### Service Bindings

```typescript
/**
 * @service-binding SVC_DAYCOUNT
 * @target daycount
 * @purpose Calculate year fractions
 */
```

---

## 🔍 Tooling & CI

**Extraction:**

- Custom parser scans services for annotations
- Outputs `docs/architecture/metadata.json`
- PlantUML generator creates C4 diagrams

**CI Workflow (on push to `main`):**

1. Extract metadata from all services
2. Generate C4 diagrams (Context, Container, Component)
3. Generate dependency graph
4. Publish to `docs/architecture/`

**Validation (on PRs):**

- Metadata linting: Required tags present
- Dependency validation: References resolve
- Diagram generation: PlantUML renders without errors

---

## 📐 Diagram Standards

**C4 Model Levels:**

1. **Context** – System + external dependencies (Auth0, Cloudflare)
2. **Container** – All Workers, Pages, Gateway
3. **Component** – Internal structure per service

**File Organization:**

```
docs/architecture/
├── diagrams/
│   ├── c4-context.puml
│   ├── c4-container.puml
│   └── components/
│       ├── gateway.puml
│       └── daycount.puml
├── generated/
│   ├── c4-context.png
│   ├── metadata.json
│   └── dependency-graph.dot
└── README.md
```

---

## 💬 Why this works

- Architecture diagrams **never lie** – generated from real code
- Developers see metadata while reading/editing
- CI enforces consistency
- Onboarding is faster – diagrams are trustworthy
- Refactoring is safer – dependency changes tracked

**Trade-offs accepted:**

- Takes setup time initially
- Diagrams not as "pretty" as manual ones
- Requires discipline to update annotations

Worth it for **always accurate** documentation.

---

## 📎 Outcome

Open the repo and instantly see:

- What services exist
- How they connect
- How Cloudflare routing works
- Know the diagram came from real code, not memory

That's the whole point.
