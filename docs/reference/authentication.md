# Authentication Reference

**Quick Reference:** How Bond Math authenticates and authorizes API requests.

---

## Architecture

```
User (SPA) → Auth0 JWT → Gateway → Internal JWT (HMAC-SHA256) → Services
```

**External:** Auth0 RS256 tokens (public/private key) **Internal:** HMAC-SHA256
tokens (shared secret, 90s TTL)

See: [ADR-0011: Symmetric JWT](../adr/0011-symmetric-jwt-for-internal-auth.md)

---

## Setup: Local Development

### 1. Generate Secret

```bash
openssl rand -base64 32
```

### 2. Create `.dev.vars`

```bash
cd iac/workers
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your secret and Auth0 credentials
```

### 3. Start Services

```bash
cd services/gateway
npm run dev

cd services/daycount
npm run dev
```

---

## Setup: Production

### Set Secrets (Same Value for All Services)

```bash
cd iac/workers

# Generate once
SECRET=$(openssl rand -base64 32)

# Apply to all services
for service in gateway daycount valuation metrics pricing; do
  echo "Setting secret for $service..."
  wrangler secret put INTERNAL_JWT_SECRET --config ${service}.toml
  # Paste same $SECRET for all
done

# Auth0 secrets (Gateway only)
wrangler secret put AUTH0_DOMAIN --config gateway.toml
wrangler secret put AUTH0_AUDIENCE --config gateway.toml
```

---

## Auth0 Configuration

### Auth0 Client Configurations

| Variable                 | Value                                                        | Description                       |
| ------------------------ | ------------------------------------------------------------ | --------------------------------- |
| `AUTH0_ISSUER`           | `https://auth.bondmath.chrislyons.dev/`                      | The tenant’s OIDC issuer URL      |
| `AUTH0_AUDIENCE`         | `https://bond-math.api`                                      | Your API identifier               |
| `AUTH0_JWKS_URL`         | `https://auth.bondmath.chrislyons.dev/.well-known/jwks.json` | JWKS key set for verifying tokens |
| `PUBLIC_AUTH0_DOMAIN`    | `auth.bondmath.chrislyons.dev`                               | For your SPA                      |
| `PUBLIC_AUTH0_CLIENT_ID` | `CmvF4tGV7zqTfEk6MRAXXGkQBNPDO9Bu`                           | Auth0 client ID for login         |

### Create API

1. **Auth0 Dashboard** → APIs → Create API
2. **Identifier:** `https://api.bondmath.chrislyons.dev`
3. **Signing Algorithm:** RS256

### Define Permissions

**Auth0 Dashboard → APIs → Your API → Permissions**

Add the following scopes:

| Scope             | Description                                                     | Use Case                               |
| ----------------- | --------------------------------------------------------------- | -------------------------------------- |
| `daycount:read`   | View day count calculations (year fractions, accrual days)      | Public API access, read-only users     |
| `daycount:write`  | Create new day count calculations                               | Professional tier batch processing     |
| `valuation:read`  | View bond valuation results (price, yield, duration, convexity) | Market data consumers, analytics users |
| `valuation:write` | Submit bond valuation requests                                  | Professional pricing tools             |
| `metrics:read`    | Access user-specific API usage and performance metrics          | Personal dashboards, usage monitoring  |
| `metrics:write`   | Submit custom metrics and telemetry data                        | Application instrumentation            |
| `pricing:read`    | Read market pricing data and curves                             | Market surveillance, research tools    |
| `pricing:write`   | Submit pricing requests and curve builds                        | Trading systems, pricing engines       |

Potential future scopes:

| Scope                | Description                                                      | Use Case                                 |
| -------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `batch:execute`      | Run large-scale batch operations (multiple calculations at once) | High-volume professional workflows       |
| `admin:users:read`   | View user accounts, roles, and permissions                       | Admin dashboards, user management UIs    |
| `admin:users:write`  | Modify user roles, quotas, and access levels                     | User provisioning, tier upgrades         |
| `admin:metrics:read` | Access system-wide metrics and analytics across all users        | System monitoring, capacity planning     |
| `admin:system:write` | Modify system configuration, feature flags, and global settings  | Infrastructure management, ops workflows |

**Role-to-Scope Mappings:**

| Role         | Scopes                                                                                  |
| ------------ | --------------------------------------------------------------------------------------- |
| Free         | `daycount:read`, `valuation:read`, `metrics:read`, `pricing:read`                       |
| Professional | All Free scopes + `daycount:write`, `valuation:write`, `metrics:write`, `pricing:write` |

### Example JWT Content

```json
{
  "iss": "https://auth.bondmath.chrislyons.dev/",
  "sub": "auth0|me",
  "aud": [
    "https://bond-math.api",
    "https://dev-z3hqqgufr7d32m25.us.auth0.com/userinfo"
  ],
  "iat": 9999999999,
  "exp": 9999999999,
  "scope": "openid",
  "azp": "a-value",
  "permissions": [
    "daycount:read",
    "daycount:write",
    "metrics:read",
    "metrics:write",
    "pricing:read",
    "pricing:write",
    "valuation:read",
    "valuation:write"
  ]
}
```

### Create Auth0 Action (Post-Login)

**Actions** → Library → Create Action → "Add Custom Claims"

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://bondmath.chrislyons.dev';
  const role = event.user.app_metadata?.role || 'free';

  const permissions =
    {
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
      ],
    }[role] || [];

  api.accessToken.setCustomClaim(`${namespace}/role`, role);
  api.accessToken.setCustomClaim(`${namespace}/permissions`, permissions);
  api.accessToken.setCustomClaim(`${namespace}/user_id`, event.user.user_id);
};
```

### Test User Setup

**Users** → Create User → **User Metadata**

```json
{
  "role": "professional"
}
```

---

## Scope Enforcement

### Gateway (services/gateway/src/jwt.ts)

Extracts Auth0 custom claims and mints internal JWT:

```typescript
const permissions = claims['https://bondmath.chrislyons.dev/permissions'] || [];
const role = claims['https://bondmath.chrislyons.dev/role'];
```

### Services (services/\*/src/scopes.ts)

```typescript
import { requireScopes } from './scopes';

app.use('/count', verifyInternalJWT('svc-daycount'));
app.use('/count', requireScopes('daycount:write'));
```

---

## Secret Rotation

### Zero-Downtime Procedure

```bash
# 1. Update all verifiers first
for service in daycount valuation metrics pricing; do
  wrangler secret put INTERNAL_JWT_SECRET --config ${service}.toml
done

# 2. Wait 90 seconds (token TTL)
sleep 90

# 3. Update minter (Gateway) last
wrangler secret put INTERNAL_JWT_SECRET --config gateway.toml
```

**Recommended:** Rotate every 90 days

---

## Troubleshooting

| Error                          | Cause                                | Fix                                                                |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------------ |
| `Invalid token signature`      | Different secrets                    | Verify same secret: `wrangler secret list --config <service>.toml` |
| `Token expired`                | Clock skew or TTL too short          | Increase `INTERNAL_JWT_TTL` in gateway.toml                        |
| `Missing Authorization header` | No token sent                        | Include `Authorization: Bearer <token>` header                     |
| `Insufficient permissions`     | Missing scope                        | Check user's role grants required scope                            |
| `Secret not configured`        | Missing .dev.vars or wrangler secret | Create .dev.vars from example or set via wrangler                  |

---

## References

- [ADR-0005: Zero-Trust Authorization](../adr/0005-zero-trust-authorization.md)
- [ADR-0006: Gateway Worker](../adr/0006-gateway-worker.md)
- [ADR-0011: Symmetric JWT](../adr/0011-symmetric-jwt-for-internal-auth.md)
- [ADR-0012: Scope-Based Authorization](../adr/0012-scope-based-authorization.md)
- [Authorization Model](../design/authorization-model.md)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Auth0 Custom Claims](https://auth0.com/docs/secure/tokens/json-web-tokens/create-custom-claims)
- [Auth0 Actions](https://auth0.com/docs/customize/actions)
