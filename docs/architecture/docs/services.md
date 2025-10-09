# Service Inventory

> **Auto-generated from code** - Last updated: 2025-10-09

Complete inventory of all services in the Bond Math architecture.

## Summary

| Service                           | Type       | Layer          | Description                                                                                             |
| --------------------------------- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| [Bond Valuation](#bond-valuation) | Python     | Business Logic | Price ↔ yield calculations and cashflow generation for bullet bonds                                    |
| [Daycount](#daycount)             | TypeScript | Business Logic | Authoritative day-count and year-fraction calculations for fixed income                                 |
| [Gateway](#gateway)               | TypeScript | Api Gateway    | Entry point for all API traffic - handles Auth0 verification, internal JWT minting, and service routing |
| [Metrics](#metrics)               | Python     | Business Logic | Bond risk metrics (duration, convexity, PV01, DV01)                                                     |
| [Pricing](#pricing)               | Python     | Business Logic | Curve-based cashflow discounting and present value calculations                                         |

## Service Details

### Bond Valuation {#bond-valuation}

**ID:** `bond-valuation`  
**Type:** cloudflare-worker-python  
**Layer:** Business Logic

Price ↔ yield calculations and cashflow generation for bullet bonds

**Endpoints:**

- `POST /price`
  - **Auth:** internal-jwt
- `POST /yield`
  - **Auth:** internal-jwt

**Used by (incoming):**

- Gateway

**Components:** 1

![Bond Valuation Component Diagram](../diagrams/structurizr-Components_bond-valuation.png)

**[View detailed documentation →](./components/bond-valuation.md)**

### Daycount {#daycount}

**ID:** `daycount`  
**Type:** cloudflare-worker-typescript  
**Layer:** Business Logic

Authoritative day-count and year-fraction calculations for fixed income

**Used by (incoming):**

- Gateway

**Components:** 16

![Daycount Component Diagram](../diagrams/structurizr-Components_daycount.png)

**[View detailed documentation →](./components/daycount.md)**

### Gateway {#gateway}

**ID:** `gateway`  
**Type:** cloudflare-worker-typescript  
**Layer:** Api Gateway

Entry point for all API traffic - handles Auth0 verification, internal JWT
minting, and service routing

**Dependencies (outgoing):**

- Bond Valuation (`service-binding`, auth: internal-jwt)
- Daycount (`service-binding`, auth: internal-jwt)
- Metrics (`service-binding`, auth: internal-jwt)
- Pricing (`service-binding`, auth: internal-jwt)

**Components:** 13

![Gateway Component Diagram](../diagrams/structurizr-Components_gateway.png)

**[View detailed documentation →](./components/gateway.md)**

### Metrics {#metrics}

**ID:** `metrics`  
**Type:** cloudflare-worker-python  
**Layer:** Business Logic

Bond risk metrics (duration, convexity, PV01, DV01)

**Endpoints:**

- `POST /duration`
  - **Auth:** internal-jwt
- `POST /convexity`
  - **Auth:** internal-jwt
- `POST /risk`
  - **Auth:** internal-jwt

**Used by (incoming):**

- Gateway

**Components:** 1

![Metrics Component Diagram](../diagrams/structurizr-Components_metrics.png)

**[View detailed documentation →](./components/metrics.md)**

### Pricing {#pricing}

**ID:** `pricing`  
**Type:** cloudflare-worker-python  
**Layer:** Business Logic

Curve-based cashflow discounting and present value calculations

**Endpoints:**

- `POST /value`
  - **Auth:** internal-jwt
- `POST /scenario`
  - **Auth:** internal-jwt
- `POST /key-rate`
  - **Auth:** internal-jwt

**Used by (incoming):**

- Gateway

**Components:** 1

![Pricing Component Diagram](../diagrams/structurizr-Components_pricing.png)

**[View detailed documentation →](./components/pricing.md)**
