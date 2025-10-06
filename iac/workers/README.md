# Cloudflare Workers Configuration

This directory contains Wrangler configuration files (`.toml`) for all Bond Math Cloudflare Workers.

## 📁 Structure

```
iac/workers/
├── gateway.toml         # API Gateway Worker
├── daycount.toml        # Day Count Worker
├── valuation.toml       # Bond Valuation Worker (Python)
├── metrics.toml         # Metrics Worker (Python)
├── pricing.toml         # Pricing Engine Worker (Java)
├── .dev.vars           # Local secrets (gitignored - create from example)
├── .dev.vars.example   # Template for local secrets
└── README.md           # This file
```

## 🚀 Quick Start

### 1. Set Up Local Secrets

```bash
# Copy example file
cp .dev.vars.example .dev.vars

# Generate a secure secret
openssl rand -base64 32

# Edit .dev.vars and replace placeholder values
# Use the same INTERNAL_JWT_SECRET for all services!
```

### 2. Configure Auth0 (Gateway Only)

Update `.dev.vars` with your Auth0 credentials:
- `AUTH0_DOMAIN` - Your Auth0 tenant domain
- `AUTH0_AUDIENCE` - API identifier from Auth0

See [Authentication Reference](../../docs/reference/authentication.md)

### 3. Start a Service Locally

```bash
# Gateway
cd ../../services/gateway
npm run dev

# Day Count
cd ../../services/daycount
npm run dev
```

Wrangler automatically loads secrets from `iac/workers/.dev.vars`

## 🔧 Configuration Files

### Gateway (`gateway.toml`)

**Entry Point:** `../../services/gateway/src/index.ts`

**Service Bindings:**
- `SVC_DAYCOUNT` → Day Count Worker
- `SVC_VALUATION` → Valuation Worker
- `SVC_METRICS` → Metrics Worker
- `SVC_PRICING` → Pricing Worker

**Required Secrets:**
- `INTERNAL_JWT_SECRET` - Shared secret for internal JWTs
- `AUTH0_DOMAIN` - Auth0 tenant domain
- `AUTH0_AUDIENCE` - API identifier

**Environment Variables:**
- `INTERNAL_JWT_TTL` - Token lifetime (default: 90s)

### Day Count (`daycount.toml`)

**Entry Point:** `../../services/daycount/src/index.ts`

**Required Secrets:**
- `INTERNAL_JWT_SECRET` - Must match Gateway's secret

**Environment Variables:**
- `ENVIRONMENT` - Environment name (dev/preview/prod)

### Valuation (`valuation.toml`)

**Entry Point:** `../../services/valuation/src/index.py` (Python)

**Required Secrets:**
- `INTERNAL_JWT_SECRET` - Must match Gateway's secret

**Service Bindings:**
- `SVC_DAYCOUNT` → Day Count Worker (for accrual calculations)

### Metrics (`metrics.toml`)

**Entry Point:** `../../services/metrics/src/index.py` (Python)

**Required Secrets:**
- `INTERNAL_JWT_SECRET` - Must match Gateway's secret

**Service Bindings:**
- `SVC_VALUATION` → Valuation Worker (for re-pricing)
- `SVC_DAYCOUNT` → Day Count Worker

### Pricing (`pricing.toml`)

**Entry Point:** `../../services/pricing/src/index.java` (Java)

**Required Secrets:**
- `INTERNAL_JWT_SECRET` - Must match Gateway's secret

## 🔐 Secrets Management

### Local Development

**Use `.dev.vars` file:**
```bash
# Already gitignored
# Loaded automatically by Wrangler
# Same file shared by all services
```

### Production

**Use Wrangler secrets:**
```bash
# Set for each service
wrangler secret put INTERNAL_JWT_SECRET --config gateway.toml
wrangler secret put INTERNAL_JWT_SECRET --config daycount.toml
wrangler secret put INTERNAL_JWT_SECRET --config valuation.toml
wrangler secret put INTERNAL_JWT_SECRET --config metrics.toml
wrangler secret put INTERNAL_JWT_SECRET --config pricing.toml

# ⚠️ Use THE SAME value for all services!

# Auth0 secrets (Gateway only)
wrangler secret put AUTH0_DOMAIN --config gateway.toml
wrangler secret put AUTH0_AUDIENCE --config gateway.toml
```

### Multi-Environment

**Different secrets per environment:**
```bash
# Preview
wrangler secret put INTERNAL_JWT_SECRET --env preview --config gateway.toml

# Production (default)
wrangler secret put INTERNAL_JWT_SECRET --config gateway.toml
```

See [Authentication Reference](../../docs/reference/authentication.md) for complete documentation.

## 📊 Environments

Each service supports three environments:

### Development (Local)
- Uses `.dev.vars` for secrets
- Service bindings point to local instances
- Run with: `npm run dev`

### Preview
- Deployed to Cloudflare with `-preview` suffix
- Separate secrets from production
- Deploy with: `wrangler deploy --env preview`

### Production
- Default environment
- Production secrets from Wrangler
- Deploy with: `wrangler deploy`

## 🔄 Common Commands

### Local Development
```bash
# Start service locally
npm run dev --prefix ../../services/gateway

# Test locally
curl http://localhost:8787/health
```

### Deployment
```bash
# Deploy to production
npm run deploy --prefix ../../services/gateway

# Deploy to preview
npm run deploy:preview --prefix ../../services/gateway
```

### Secrets Management
```bash
# List secrets (shows names only)
wrangler secret list --config gateway.toml

# Set a secret
wrangler secret put INTERNAL_JWT_SECRET --config gateway.toml

# Delete a secret
wrangler secret delete INTERNAL_JWT_SECRET --config gateway.toml
```

### Logs
```bash
# Tail production logs
wrangler tail --config gateway.toml

# Tail preview logs
wrangler tail --env preview --config gateway.toml
```

## 🧪 Testing Configuration

### Verify Secrets Are Loaded
```bash
# Start service
npm run dev --prefix ../../services/gateway

# Check health endpoint
curl http://localhost:8787/health

# Should return 200 OK
```

### Verify Service Bindings
```bash
# Start all required services first
# Then test gateway routing
curl -X POST http://localhost:8787/api/daycount/v1/count \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"pairs":[{"start":"2025-01-01","end":"2025-07-01"}],"convention":"ACT_360"}'
```

## 🐛 Troubleshooting

### "Secret not configured" error

**Local:**
```bash
# Check .dev.vars exists
cat .dev.vars

# Create from example if missing
cp .dev.vars.example .dev.vars
```

**Production:**
```bash
# Verify secret is set
wrangler secret list --config gateway.toml

# Set if missing
wrangler secret put INTERNAL_JWT_SECRET --config gateway.toml
```

### "Service binding not found"

**Check service names match:**
```bash
# In gateway.toml, binding should match deployed service name
[[services]]
binding = "SVC_DAYCOUNT"
service = "bond-math-daycount"  # Must match deployed name

# Verify service is deployed
wrangler deployments list --name bond-math-daycount
```

### "Invalid token signature"

**Cause:** Different secrets between Gateway and services

**Fix:**
```bash
# Ensure same secret for all services
SECRET=$(openssl rand -base64 32)

for service in gateway daycount valuation metrics pricing; do
  wrangler secret put INTERNAL_JWT_SECRET --config ${service}.toml
  # Enter same $SECRET for all
done
```

## 📚 Documentation

- [Authentication Reference](../../docs/reference/authentication.md) - Complete setup guide
- [ADR-0011: Symmetric JWT](../../docs/adr/0011-symmetric-jwt-for-internal-auth.md)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

## 🔗 Service Dependencies

```
┌─────────┐
│ Gateway │ ──┬──> SVC_DAYCOUNT
└─────────┘   ├──> SVC_VALUATION ──> SVC_DAYCOUNT
              ├──> SVC_METRICS ────┬──> SVC_VALUATION
              │                    └──> SVC_DAYCOUNT
              └──> SVC_PRICING
```

**Important:** Deploy services in dependency order:
1. Day Count (no dependencies)
2. Valuation (depends on Day Count)
3. Metrics (depends on Valuation, Day Count)
4. Pricing (no dependencies)
5. Gateway (depends on all)

## 🛡️ Security Best Practices

✅ **DO:**
- Use `.dev.vars` for local development
- Use `wrangler secret put` for production
- Generate secrets with `openssl rand -base64 32`
- Use different secrets per environment
- Rotate secrets every 90 days

❌ **DON'T:**
- Commit `.dev.vars` to git (already gitignored)
- Share production secrets via email/Slack
- Reuse development secrets in production
- Use weak/guessable secrets
- Log secret values

## 📝 Notes

- All configuration files use relative paths to service source code
- Service bindings keep traffic internal to Cloudflare (no public hops)
- Secrets are encrypted at rest by Cloudflare
- `.dev.vars` is shared across all services for simplicity
- Environment variables (non-secret) are in `.toml` files
- Secrets (sensitive) are in Wrangler's encrypted storage

---

**Need Help?** See [Authentication Reference](../../docs/reference/authentication.md#troubleshooting)
