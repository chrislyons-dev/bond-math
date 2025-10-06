# ADR 0012 – Scope-Based Authorization with RBAC

**Status:** Accepted
**Date:** 2025-10-06
**Context:** Defining how to control access to Bond Math API endpoints and enforce permissions across services.

---

## Context

Bond Math needs an **authorization model** — deciding _who can do what_.

We already have **authentication** (ADR-0004: Auth0) and **zero-trust token propagation** (ADR-0005, ADR-0006, ADR-0011). Now we need to define:

- **What roles exist** (student, professional, admin, etc.)
- **What permissions each role has** (can calculate prices, can batch process, etc.)
- **How permissions are expressed** (OAuth scopes vs custom claims)
- **Where enforcement happens** (gateway vs individual services)

This is a classic **Role-Based Access Control (RBAC)** problem in a microservices context.

---

## Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **No authorization** | Anyone with Auth0 login can call any endpoint | Simple, fast development | Insecure, no monetization, no usage control |
| **OAuth scopes only** | Standard OAuth 2.0 scopes (`daycount:write`, etc.) | Industry standard, simple enforcement | Limited flexibility for complex permissions |
| **Custom claims only** | Store role/permissions in custom claims, no scopes | Full control, flexible | Non-standard, harder to integrate |
| **Scopes + Custom Claims** | OAuth scopes for API access, custom claims for role/org/metadata | Best of both, clear separation | Slightly more Auth0 configuration |

---

## Decision

Use **OAuth Scopes + Custom Claims (Hybrid approach)**.

**OAuth Scopes** control API access:
- `daycount:read`, `daycount:write`
- `valuation:read`, `valuation:write`
- `metrics:read`, `metrics:write`
- `pricing:read`, `pricing:write`
- `batch:execute`
- `admin:*` scopes for administrative operations

**Custom Claims** provide context:
- `https://bondmath.chrislyons.dev/role` - User's role (free, professional, admin)
- `https://bondmath.chrislyons.dev/permissions` - Effective permissions list
- `https://bondmath.chrislyons.dev/user_id` - Internal user ID
- `https://bondmath.chrislyons.dev/org_id` - Organization (for future multi-tenancy)

**Enforcement happens at two layers:**
1. **Gateway** - Validates Auth0 token, extracts scopes/claims, passes to services
2. **Services** - Verify internal JWT and check `act.perms` for required scopes

---

## Rationale

**OAuth Scopes = Standard API Access Control**
- Standard pattern that OAuth/OIDC clients understand
- Easy to integrate with Auth0 dashboard and API settings
- Clear, self-documenting permissions (`valuation:write` means "can write to valuation API")

**Custom Claims = Rich Context**
- Provides role for UI personalization
- Includes org_id for future multi-tenancy
- Stores user_id for audit logging
- Flexible for adding new metadata without changing scopes

**Role-Based Access Control (RBAC)** with 4 primary roles:
1. **Free** - Read-only access, limited rate limits
2. **Professional** - Full calculation access, batch operations
3. **Admin** - All access + user/system management
4. **Service** - Machine-to-machine (M2M) for automated systems

---

## Trade-offs Accepted

**Auth0 Action Required**
- Configuration lives partly in Auth0 (not just code)
- Need to maintain the Action script
- **Mitigation:** Document the Action, version it in repo for reference

**Service-Level Scope Checking Required**
- Each service must validate scopes from the internal JWT's `act.perms` claim
- **Benefit:** Defense in depth - even if gateway is compromised, services still enforce

**Limited to 5-6 Roles Initially**
- RBAC works best with ~3-5 roles
- Start with: Free, Professional, Admin, Service
- **Future:** Can add Organization-level permissions if needed

---

## Security Model

**Scope Enforcement at Every Layer:**
1. **Auth0** validates client is allowed to request scopes
2. **Gateway** validates Auth0 token includes required scopes
3. **Services** validate internal JWT includes required scopes
4. If any layer fails → 401/403 response

**Audit Trail:** Every request includes:
- Request ID (`rid`)
- User ID (`act.sub`)
- Effective permissions (`act.perms`)
- Logged at gateway and each service

---

## Outcome

Bond Math uses a **hybrid OAuth scopes + custom claims model** for authorization:

✅ **Standard OAuth scopes** for API access control (industry best practice)
✅ **Custom claims** for role and metadata (flexibility)
✅ **RBAC** with 4 well-defined roles (simplicity)
✅ **Defense in depth** with enforcement at gateway AND services (security)
✅ **Audit trail** with request IDs and user context (compliance)

This approach gives us familiar patterns for OAuth/OIDC developers, clear access control, extensibility for future features, and security with multiple enforcement layers.

---

## Related Documentation

- **Complete Model:** [Authorization Model Design](../design/authorization-model.md) - Roles, scopes, permissions, token examples
- **Related ADRs:** ADR-0004 (Auth0), ADR-0005 (Zero-Trust), ADR-0011 (Internal JWT)

---

## References

- [OAuth 2.0 Scopes (RFC 6749)](https://datatracker.ietf.org/doc/html/rfc6749#section-3.3)
- [Auth0 RBAC](https://auth0.com/docs/manage-users/access-control/rbac)
- [Auth0 Custom Claims](https://auth0.com/docs/secure/tokens/json-web-tokens/create-custom-claims)
