# Bond Math Authorization Model

**Status:** Draft for Review **Date:** 2025-10-06 **Purpose:** Define roles,
permissions, scopes, and claims for Bond Math API authorization

**Contents**

- [Bond Math Authorization Model](#bond-math-authorization-model)
  - [🎯 Design Goals](#-design-goals)
  - [👥 User Personas](#-user-personas)
    - [1. **Anonymous User** (Not Authenticated)](#1-anonymous-user-not-authenticated)
    - [2. **Free Tier User** (Basic)](#2-free-tier-user-basic)
    - [3. **Professional User** (Standard)](#3-professional-user-standard)
    - [4. **Admin User** (Admin)](#4-admin-user-admin)
    - [5. **Service Account** (Machine-to-Machine)](#5-service-account-machine-to-machine)
  - [🔑 Permission Model](#-permission-model)
    - [Permission Hierarchy](#permission-hierarchy)
    - [Permission Domains](#permission-domains)
    - [Resource Types](#resource-types)
    - [Actions](#actions)
  - [📋 Scopes (OAuth 2.0 Scopes)](#-scopes-oauth-20-scopes)
    - [Standard Scopes](#standard-scopes)
    - [Scope Patterns](#scope-patterns)
  - [👤 Roles → Scopes Mapping](#-roles--scopes-mapping)
    - [Anonymous (No Authentication)](#anonymous-no-authentication)
    - [Free Tier User](#free-tier-user)
    - [Professional User](#professional-user)
    - [Admin User](#admin-user)
    - [Service Account (M2M)](#service-account-m2m)
  - [🎫 JWT Claims Structure](#-jwt-claims-structure)
    - [Auth0 Access Token (External)](#auth0-access-token-external)
    - [Internal JWT (Service-to-Service)](#internal-jwt-service-to-service)
  - [🗺️ Scope → Endpoint Mapping](#️-scope--endpoint-mapping)
    - [Day Count Service](#day-count-service)
    - [Valuation Service](#valuation-service)
    - [Metrics Service](#metrics-service)
    - [Pricing Service](#pricing-service)
    - [Admin Endpoints (Future)](#admin-endpoints-future)
  - [🔒 Authorization Enforcement](#-authorization-enforcement)
    - [Gateway Layer](#gateway-layer)
    - [Service Layer](#service-layer)
  - [📊 Custom Claims Strategy](#-custom-claims-strategy)
    - [Namespace Convention](#namespace-convention)
    - [Standard Custom Claims](#standard-custom-claims)
    - [Auth0 Action to Add Claims](#auth0-action-to-add-claims)
  - [🎯 Implementation Checklist](#-implementation-checklist)
    - [Auth0 Configuration](#auth0-configuration)
    - [Gateway Implementation](#gateway-implementation)
    - [Service Implementation](#service-implementation)
    - [Testing](#testing)
  - [🔄 Migration Path](#-migration-path)
    - [Phase 1: Basic Implementation (Week 1)](#phase-1-basic-implementation-week-1)
    - [Phase 2: Enhanced (Week 2-3)](#phase-2-enhanced-week-2-3)
    - [Phase 3: Admin Features (Week 4+)](#phase-3-admin-features-week-4)
  - [📚 References](#-references)

---

## 🎯 Design Goals

1. **Simple but realistic** - Demonstrate real-world patterns without
   over-engineering
2. **Role-based access control (RBAC)** - Users have roles, roles have
   permissions
3. **Least privilege** - Users get only what they need
4. **Auditable** - Every action traceable to a user
5. **Extensible** - Easy to add new roles/permissions as services grow

---

## 👥 User Personas

### 1. **Anonymous User** (Not Authenticated)

- **Who:** Public visitors, demos, documentation readers
- **Access:** Public documentation, health checks only
- **Use Case:** "I want to see what Bond Math does before signing up"

### 2. **Free Tier User** (Basic)

- **Who:** Students, hobbyists, evaluation users
- **Access:** Read-only access to basic calculations
- **Limits:** Rate limited, no bulk operations
- **Use Case:** "I need to calculate yield for a homework assignment"

### 3. **Professional User** (Standard)

- **Who:** Finance professionals, analysts, portfolio managers
- **Access:** Full read/write access to all calculation endpoints
- **Limits:** Higher rate limits, batch operations allowed
- **Use Case:** "I need to price 100 bonds daily for portfolio analysis"

### 4. **Admin User** (Admin)

- **Who:** System administrators, service operators
- **Access:** All user capabilities + admin endpoints
- **Capabilities:** View metrics, manage users, system configuration
- **Use Case:** "I need to monitor system health and manage access"

### 5. **Service Account** (Machine-to-Machine)

- **Who:** Automated systems, CI/CD, integrations
- **Access:** API-only access with specific scopes
- **Auth:** Client credentials flow (no interactive login)
- **Use Case:** "My trading system needs to price bonds automatically"

---

## 🔑 Permission Model

### Permission Hierarchy

```
Domain:Resource:Action

Examples:
- daycount:calculations:read
- valuation:pricing:write
- metrics:analytics:read
- admin:users:write
```

### Permission Domains

| Domain      | Description                              | Services              |
| ----------- | ---------------------------------------- | --------------------- |
| `daycount`  | Day count and year fraction calculations | Day Count Worker      |
| `valuation` | Bond pricing and yield calculations      | Valuation Worker      |
| `metrics`   | Risk metrics (duration, convexity, PV01) | Metrics Worker        |
| `pricing`   | Cashflow discounting and PV calculations | Pricing Worker        |
| `admin`     | System administration and monitoring     | Gateway, All Services |

### Resource Types

| Resource       | Description                        |
| -------------- | ---------------------------------- |
| `calculations` | Calculation endpoints (read/write) |
| `pricing`      | Pricing operations                 |
| `analytics`    | Analytical calculations            |
| `users`        | User management                    |
| `system`       | System configuration               |
| `metrics`      | System metrics and monitoring      |

### Actions

| Action    | Description        | HTTP Methods     |
| --------- | ------------------ | ---------------- |
| `read`    | View/query data    | GET              |
| `write`   | Create/modify data | POST, PUT, PATCH |
| `delete`  | Remove data        | DELETE           |
| `execute` | Run operations     | POST             |
| `manage`  | Full control       | ALL              |

---

## 📋 Scopes (OAuth 2.0 Scopes)

### Standard Scopes

```
# Basic access
openid                    # Required for OIDC
profile                   # User profile info
email                     # User email

# Day Count Service
daycount:read             # Read day count calculations
daycount:write            # Perform day count calculations

# Valuation Service
valuation:read            # Read pricing results
valuation:write           # Calculate price/yield

# Metrics Service
metrics:read              # Read risk metrics
metrics:write             # Calculate duration/convexity

# Pricing Service
pricing:read              # Read cashflow PV
pricing:write             # Calculate PV from cashflows

# Batch Operations
batch:execute             # Execute batch calculations (Professional+)

# Admin
admin:users:read          # View user information
admin:users:write         # Manage users
admin:metrics:read        # View system metrics
admin:system:write        # Configure system settings
```

### Scope Patterns

**Read Scopes:**

- `{service}:read` - View calculation results, cached data
- Used for: GET endpoints, viewing history

**Write Scopes:**

- `{service}:write` - Perform calculations, submit requests
- Used for: POST endpoints, creating calculations

**Admin Scopes:**

- `admin:{resource}:{action}` - Administrative operations
- Used for: User management, system monitoring

---

## 👤 Roles → Scopes Mapping

### Anonymous (No Authentication)

```json
{
  "scopes": []
}
```

**Access:** Health checks only (`/health`, `/api/*/health`)

---

### Free Tier User

```json
{
  "role": "free",
  "scopes": [
    "openid",
    "profile",
    "email",
    "daycount:read",
    "valuation:read",
    "metrics:read",
    "pricing:read"
  ]
}
```

**Can:**

- ✅ View calculation examples
- ✅ Perform single calculations (limited rate)
- ✅ Access documentation

**Cannot:**

- ❌ Batch operations
- ❌ Write to history/save results
- ❌ Access premium features

**Rate Limits:**

- 10 requests/minute
- Max 1 calculation per request

---

### Professional User

```json
{
  "role": "professional",
  "scopes": [
    "openid",
    "profile",
    "email",
    "daycount:read",
    "daycount:write",
    "valuation:read",
    "valuation:write",
    "metrics:read",
    "metrics:write",
    "pricing:read",
    "pricing:write",
    "batch:execute"
  ]
}
```

**Can:**

- ✅ All Free Tier capabilities
- ✅ Batch calculations (up to 100 bonds)
- ✅ Save calculation history
- ✅ Export results
- ✅ API access with higher rate limits

**Cannot:**

- ❌ Administer users
- ❌ View system metrics

**Rate Limits:**

- 100 requests/minute
- Max 100 calculations per request

---

### Admin User

```json
{
  "role": "admin",
  "scopes": [
    "openid",
    "profile",
    "email",
    "daycount:read",
    "daycount:write",
    "valuation:read",
    "valuation:write",
    "metrics:read",
    "metrics:write",
    "pricing:read",
    "pricing:write",
    "batch:execute",
    "admin:users:read",
    "admin:users:write",
    "admin:metrics:read",
    "admin:system:write"
  ]
}
```

**Can:**

- ✅ All Professional capabilities
- ✅ Manage users and roles
- ✅ View system metrics
- ✅ Configure system settings
- ✅ Access admin dashboard

**Rate Limits:**

- 1000 requests/minute
- No calculation limits

---

### Service Account (M2M)

```json
{
  "role": "service",
  "scopes": [
    "daycount:write",
    "valuation:write",
    "metrics:write",
    "pricing:write",
    "batch:execute"
  ]
}
```

**Can:**

- ✅ Perform calculations via API
- ✅ Batch operations
- ✅ High rate limits

**Cannot:**

- ❌ Access UI
- ❌ Admin operations

**Rate Limits:**

- 500 requests/minute per service account
- Max 1000 calculations per request

**Auth:** Client Credentials flow (client_id + client_secret)

---

## 🎫 JWT Claims Structure

### Auth0 Access Token (External)

```json
{
  "iss": "https://bond-math.auth0.com/",
  "sub": "auth0|65f3c8d9e1a2b3c4d5e6f7g8",
  "aud": "https://api.bondmath.chrislyons.dev",
  "azp": "spa-client-id",
  "exp": 1733444504,
  "iat": 1733440904,
  "scope": "openid profile email daycount:read daycount:write valuation:read valuation:write",

  // Custom claims (namespace: https://bondmath.chrislyons.dev/)
  "https://bondmath.chrislyons.dev/role": "professional",
  "https://bondmath.chrislyons.dev/user_id": "usr_abc123",
  "https://bondmath.chrislyons.dev/org_id": "org_xyz789",
  "https://bondmath.chrislyons.dev/permissions": [
    "daycount:read",
    "daycount:write",
    "valuation:read",
    "valuation:write",
    "metrics:read",
    "metrics:write",
    "pricing:read",
    "pricing:write",
    "batch:execute"
  ]
}
```

### Internal JWT (Service-to-Service)

```json
{
  "iss": "https://gateway.bond-math",
  "sub": "svc-gateway",
  "aud": "svc-daycount",
  "exp": 1733444594,
  "iat": 1733444504,
  "rid": "req_a1b2c3d4e5f6",

  // Actor claim (who the service is acting for)
  "act": {
    "iss": "https://bond-math.auth0.com/",
    "sub": "auth0|65f3c8d9e1a2b3c4d5e6f7g8",
    "role": "professional",
    "perms": [
      "daycount:read",
      "daycount:write",
      "valuation:read",
      "valuation:write"
    ],
    "org": "org_xyz789",
    "uid": "usr_abc123"
  }
}
```

---

## 🗺️ Scope → Endpoint Mapping

### Day Count Service

| Endpoint                       | Method | Required Scope   | Description                |
| ------------------------------ | ------ | ---------------- | -------------------------- |
| `/api/daycount/v1/count`       | POST   | `daycount:write` | Calculate year fractions   |
| `/api/daycount/v1/conventions` | GET    | `daycount:read`  | List supported conventions |
| `/api/daycount/v1/health`      | GET    | (none)           | Health check               |

### Valuation Service

| Endpoint                     | Method | Required Scope                      | Description                      |
| ---------------------------- | ------ | ----------------------------------- | -------------------------------- |
| `/api/valuation/v1/price`    | POST   | `valuation:write`                   | Calculate dirty price from yield |
| `/api/valuation/v1/yield`    | POST   | `valuation:write`                   | Calculate yield from price       |
| `/api/valuation/v1/schedule` | POST   | `valuation:write`                   | Generate cashflow schedule       |
| `/api/valuation/v1/batch`    | POST   | `valuation:write` + `batch:execute` | Batch price calculations         |
| `/api/valuation/v1/health`   | GET    | (none)                              | Health check                     |

### Metrics Service

| Endpoint                    | Method | Required Scope  | Description           |
| --------------------------- | ------ | --------------- | --------------------- |
| `/api/metrics/v1/duration`  | POST   | `metrics:write` | Calculate duration    |
| `/api/metrics/v1/convexity` | POST   | `metrics:write` | Calculate convexity   |
| `/api/metrics/v1/pv01`      | POST   | `metrics:write` | Calculate PV01        |
| `/api/metrics/v1/all`       | POST   | `metrics:write` | Calculate all metrics |
| `/api/metrics/v1/health`    | GET    | (none)          | Health check          |

### Pricing Service

| Endpoint                        | Method | Required Scope  | Description                      |
| ------------------------------- | ------ | --------------- | -------------------------------- |
| `/api/pricing/v1/value`         | POST   | `pricing:write` | Calculate PV of cashflows        |
| `/api/pricing/v1/sensitivities` | POST   | `pricing:write` | Calculate key rate sensitivities |
| `/api/pricing/v1/health`        | GET    | (none)          | Health check                     |

### Admin Endpoints (Future)

| Endpoint                | Method | Required Scope       | Description     |
| ----------------------- | ------ | -------------------- | --------------- |
| `/api/admin/users`      | GET    | `admin:users:read`   | List users      |
| `/api/admin/users/{id}` | PUT    | `admin:users:write`  | Update user     |
| `/api/admin/metrics`    | GET    | `admin:metrics:read` | System metrics  |
| `/api/admin/health`     | GET    | `admin:metrics:read` | Detailed health |

---

## 🔒 Authorization Enforcement

### Gateway Layer

```typescript
// Gateway validates Auth0 token and extracts permissions
const auth0Claims = await verifyAuth0Token(token);
const permissions = auth0Claims['https://bondmath.chrislyons.dev/permissions'];

// Mint internal JWT with permissions
const internalToken = await mintInternalToken(
  auth0Claims,
  targetService,
  secret
);
```

### Service Layer

```typescript
// Each service validates required scopes
function requireScopes(...requiredScopes: string[]) {
  return async (c: Context, next: Next) => {
    const actor = c.get('actor'); // From internal JWT
    const userPerms = actor.perms;

    const hasPermission = requiredScopes.every((scope) =>
      userPerms.includes(scope)
    );

    if (!hasPermission) {
      throw new HTTPException(403, {
        message: `Missing required scopes: ${requiredScopes.join(', ')}`,
      });
    }

    await next();
  };
}

// Usage
app.post('/count', requireScopes('daycount:write'), async (c) => {
  /* handler */
});
```

---

## 📊 Custom Claims Strategy

### Namespace Convention

All custom claims use Auth0's recommended namespace pattern:

```
https://bondmath.chrislyons.dev/{claim}
```

### Standard Custom Claims

| Claim         | Type     | Description         | Example               |
| ------------- | -------- | ------------------- | --------------------- |
| `role`        | string   | User's primary role | `"professional"`      |
| `permissions` | string[] | Granted permissions | `["daycount:write"]`  |
| `user_id`     | string   | Internal user ID    | `"usr_abc123"`        |
| `org_id`      | string   | Organization ID     | `"org_xyz789"`        |
| `tier`        | string   | Subscription tier   | `"professional"`      |
| `features`    | string[] | Enabled features    | `["batch", "export"]` |

### Auth0 Action to Add Claims

```javascript
// Auth0 Post-Login Action
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://bondmath.chrislyons.dev';

  // Get user metadata
  const role = event.user.app_metadata?.role || 'free';
  const org_id = event.user.app_metadata?.org_id;
  const user_id = event.user.user_id;

  // Map role to permissions
  const permissions = getRolePermissions(role);

  // Add custom claims
  api.idToken.setCustomClaim(`${namespace}/role`, role);
  api.idToken.setCustomClaim(`${namespace}/permissions`, permissions);
  api.idToken.setCustomClaim(`${namespace}/user_id`, user_id);

  if (org_id) {
    api.idToken.setCustomClaim(`${namespace}/org_id`, org_id);
  }

  // Add to access token as well
  api.accessToken.setCustomClaim(`${namespace}/role`, role);
  api.accessToken.setCustomClaim(`${namespace}/permissions`, permissions);
};

function getRolePermissions(role) {
  const roleMap = {
    free: ['daycount:read', 'valuation:read', 'metrics:read', 'pricing:read'],
    professional: [
      'daycount:read',
      'daycount:write',
      'valuation:read',
      'valuation:write',
      'metrics:read',
      'metrics:write',
      'pricing:read',
      'pricing:write',
      'batch:execute',
    ],
    admin: [
      'daycount:read',
      'daycount:write',
      'valuation:read',
      'valuation:write',
      'metrics:read',
      'metrics:write',
      'pricing:read',
      'pricing:write',
      'batch:execute',
      'admin:users:read',
      'admin:users:write',
      'admin:metrics:read',
      'admin:system:write',
    ],
  };

  return roleMap[role] || roleMap['free'];
}
```

---

## 🎯 Implementation Checklist

### Auth0 Configuration

- [ ] Create API in Auth0 (Identifier: `https://api.bondmath.chrislyons.dev`)
- [ ] Define custom scopes in API settings
- [ ] Create Auth0 Action for custom claims
- [ ] Configure default role as `free` in app_metadata
- [ ] Set up role management in Auth0 Dashboard

### Gateway Implementation

- [ ] Extract permissions from Auth0 token
- [ ] Include permissions in internal JWT `act` claim
- [ ] Implement scope validation middleware
- [ ] Add permission checks to routing logic

### Service Implementation

- [ ] Create `requireScopes()` middleware for each service
- [ ] Apply scope requirements to endpoints
- [ ] Return 403 with clear error messages for insufficient permissions
- [ ] Log permission violations for security monitoring

### Testing

- [ ] Test each role's access patterns
- [ ] Verify scope enforcement on all endpoints
- [ ] Test permission escalation attempts (should fail)
- [ ] Verify custom claims in tokens

---

## 🔄 Migration Path

### Phase 1: Basic Implementation (Week 1)

- Implement Free + Professional roles
- Basic scope enforcement on main endpoints
- No batch operations yet

### Phase 2: Enhanced (Week 2-3)

- Add batch operations with `batch:execute` scope
- Implement rate limiting per role
- Add usage tracking

### Phase 3: Admin Features (Week 4+)

- Admin dashboard
- User management endpoints
- System metrics and monitoring

---

## 📚 References

- [OAuth 2.0 Scopes](https://oauth.net/2/scope/)
- [Auth0 Custom Claims](https://auth0.com/docs/secure/tokens/json-web-tokens/create-custom-claims)
- [Auth0 RBAC](https://auth0.com/docs/manage-users/access-control/rbac)
- [RFC 8693 - Token Exchange (for `act` claim)](https://datatracker.ietf.org/doc/html/rfc8693)
