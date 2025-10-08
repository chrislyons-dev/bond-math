# Bond Math Deployment Guide

Comprehensive guide for deploying Bond Math microservices to Cloudflare Workers.

## Overview

Bond Math uses a polyglot microservices architecture deployed entirely on
Cloudflare Workers:

- **Gateway** (TypeScript) - API gateway, Auth0 verification, routing
- **Day-Count** (TypeScript) - Year fraction calculations
- **Bond Valuation** (Python) - Price/yield calculations
- **Metrics** (Python) - Duration, convexity, risk metrics
- **Pricing** (Python) - Curve-based cashflow discounting

All services communicate via Cloudflare Service Bindings with internal JWT
authentication.

## Prerequisites

### Required

- **Cloudflare Account** with Workers enabled
- **Node.js** >= 18
- **Python** >= 3.11
- **Wrangler CLI** >= 3.0
- **Terraform** >= 1.0 (for infrastructure deployment)

### Optional

- **Auth0 Account** (for production authentication)
- **Custom Domain** in Cloudflare (optional)

## Deployment Methods

### Method 1: Wrangler Only (Recommended for Development)

Deploy individual services using Wrangler CLI.

**Pros:**

- Fast iteration
- Easy debugging
- Direct control

**Cons:**

- Manual service binding configuration
- No infrastructure state management

### Method 2: Terraform + Wrangler (Recommended for Production)

Use Terraform for infrastructure, Wrangler for secrets.

**Pros:**

- Infrastructure as Code
- Automated dependency management
- State management
- Team collaboration

**Cons:**

- More complex initial setup
- Requires build artifacts

## Quick Start (Wrangler)

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Install service dependencies
npm run install --workspaces
```

### 2. Configure Local Secrets

```bash
# Create local secrets file
cp iac/workers/.dev.vars.example iac/workers/.dev.vars

# Generate secure secret
openssl rand -base64 32

# Edit .dev.vars with your values
nano iac/workers/.dev.vars
```

### 3. Build Services

```bash
# TypeScript services
cd services/gateway && npm run build
cd ../daycount && npm run build

# Python services (if you've implemented build scripts)
cd ../bond-valuation && npm run build
cd ../metrics && npm run build
cd ../pricing && npm run build
```

### 4. Deploy Services

```bash
# From iac/ directory
cd iac

# Deploy in dependency order
make wrangler-deploy-daycount
make wrangler-deploy-valuation
make wrangler-deploy-metrics
make wrangler-deploy-pricing
make wrangler-deploy-gateway

# Or deploy all at once
make wrangler-deploy-all
```

### 5. Set Production Secrets

```bash
# Generate shared secret
JWT_SECRET=$(openssl rand -base64 32)

# Set for all services (must be identical!)
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --config workers/gateway.toml
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --config workers/daycount.toml
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --config workers/valuation.toml
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --config workers/metrics.toml
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --config workers/pricing.toml

# Auth0 credentials (Gateway only)
wrangler secret put AUTH0_DOMAIN --config workers/gateway.toml
wrangler secret put AUTH0_AUDIENCE --config workers/gateway.toml
```

### 6. Test Deployment

```bash
# Get Gateway URL from Wrangler output
curl https://bond-math-gateway.your-account.workers.dev/health
```

## Full Deployment (Terraform)

### 1. Build All Services

```bash
# Build all TypeScript services
npm run build --workspaces --if-present

# Build all Python services
cd services/bond-valuation && python -m build
cd ../metrics && python -m build
cd ../pricing && python -m build
```

### 2. Configure Terraform

```bash
cd iac/tf

# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit with your Cloudflare credentials
nano terraform.tfvars
```

Required values in `terraform.tfvars`:

```hcl
cloudflare_account_id = "your-account-id"
cloudflare_api_token  = "your-api-token"  # Or use CLOUDFLARE_API_TOKEN env var

# Optional: Custom domain
cloudflare_zone_id = "your-zone-id"
domain = "bondmath.chrislyons.dev"

# Environment
environment = "production"
```

### 3. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy
terraform apply
```

### 4. Configure Secrets

After Terraform completes, set secrets:

```bash
# Follow output instructions
terraform output next_steps

# Or manually:
JWT_SECRET=$(openssl rand -base64 32)
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name bond-math-gateway
# ... repeat for all services
```

### 5. Verify Deployment

```bash
# Get Gateway URL
GATEWAY_URL=$(terraform output -raw gateway_url)

# Test health endpoint
curl $GATEWAY_URL/health

# View logs
wrangler tail --name bond-math-gateway
```

## Environment Management

### Local Development

Use `.dev.vars` for local secrets:

```bash
# iac/workers/.dev.vars
INTERNAL_JWT_SECRET="your-local-secret"
AUTH0_DOMAIN="dev-tenant.auth0.com"
AUTH0_AUDIENCE="https://api.bondmath.local"
```

Start services locally:

```bash
cd services/gateway
npm run dev  # Runs on http://localhost:8787
```

### Preview Environment

Deploy to preview environment:

```bash
# Terraform
cd iac/tf
terraform workspace new preview
terraform apply -var="environment=preview"

# Wrangler
cd iac
make deploy-preview
```

### Production Environment

Deploy to production:

```bash
# Terraform (default workspace)
cd iac/tf
terraform apply

# Wrangler
cd iac
make wrangler-deploy-all
```

## Service Dependencies

Deploy in this order (Terraform handles automatically):

```
1. Day-Count        (no dependencies)
2. Valuation        (depends on Day-Count)
3. Metrics          (depends on Valuation, Day-Count)
4. Pricing          (no dependencies)
5. Gateway          (depends on all)
```

## Custom Domain Setup

### 1. Add Domain to Cloudflare

1. Go to Cloudflare Dashboard
2. Add your domain
3. Update nameservers
4. Wait for DNS propagation

### 2. Get Zone ID

1. Cloudflare Dashboard → [Your Domain]
2. Overview → Zone ID (right sidebar)
3. Copy Zone ID

### 3. Configure Terraform

```hcl
# iac/tf/terraform.tfvars
cloudflare_zone_id = "your-zone-id"
domain = "bondmath.chrislyons.dev"
```

### 4. Deploy

```bash
cd iac/tf
terraform apply
```

Terraform creates routes:

- `bondmath.chrislyons.dev/api/*` → Gateway
- `bondmath.chrislyons.dev/*` → Gateway

## Secrets Management

### Local Development

**File:** `iac/workers/.dev.vars` (gitignored)

```bash
# Create from example
cp iac/workers/.dev.vars.example iac/workers/.dev.vars

# Edit with real values
nano iac/workers/.dev.vars
```

### Production

**Method:** Wrangler CLI

```bash
# Set secret
wrangler secret put SECRET_NAME --name worker-name

# List secrets (names only, not values)
wrangler secret list --name worker-name

# Delete secret
wrangler secret delete SECRET_NAME --name worker-name
```

### Required Secrets

| Secret                | Services     | Description                                                    |
| --------------------- | ------------ | -------------------------------------------------------------- |
| `INTERNAL_JWT_SECRET` | All          | HMAC secret for internal JWTs (must match across all services) |
| `AUTH0_DOMAIN`        | Gateway only | Auth0 tenant domain                                            |
| `AUTH0_AUDIENCE`      | Gateway only | API identifier from Auth0                                      |

### Secret Rotation

Rotate `INTERNAL_JWT_SECRET` every 90 days:

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update all services simultaneously
for worker in bond-math-gateway bond-math-daycount bond-math-valuation bond-math-metrics bond-math-pricing; do
  echo $NEW_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name $worker
done

# 3. Verify all services still work
curl https://bondmath.chrislyons.dev/health
```

## Monitoring and Observability

### View Logs

```bash
# Real-time logs
wrangler tail --name bond-math-gateway

# Filter by status
wrangler tail --name bond-math-gateway --status error

# Filter by method
wrangler tail --name bond-math-gateway --method POST
```

### Metrics

```bash
# Terraform outputs
cd iac/tf
terraform output

# Worker analytics (Cloudflare Dashboard)
# Workers & Pages → [Worker Name] → Metrics
```

### Health Checks

```bash
# Gateway
curl https://bondmath.chrislyons.dev/health

# Individual services (via Gateway)
curl https://bondmath.chrislyons.dev/api/daycount/v1/health \
  -H "Authorization: Bearer $AUTH0_TOKEN"
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: npm install

      - name: Build services
        run: npm run build --workspaces

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Terraform Init
        run: cd iac/tf && terraform init
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Terraform Apply
        run: cd iac/tf && terraform apply -auto-approve
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          TF_VAR_cloudflare_account_id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          TF_VAR_cloudflare_zone_id: ${{ secrets.CLOUDFLARE_ZONE_ID }}
          TF_VAR_domain: ${{ secrets.DOMAIN }}

      - name: Set Secrets
        run: |
          echo "${{ secrets.INTERNAL_JWT_SECRET }}" | wrangler secret put INTERNAL_JWT_SECRET --name bond-math-gateway
          echo "${{ secrets.AUTH0_DOMAIN }}" | wrangler secret put AUTH0_DOMAIN --name bond-math-gateway
          echo "${{ secrets.AUTH0_AUDIENCE }}" | wrangler secret put AUTH0_AUDIENCE --name bond-math-gateway
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Troubleshooting

### Build Errors

**Issue:** `Cannot find module 'dist/index.js'`

**Solution:** Build services before deploying:

```bash
npm run build --workspaces
```

### Service Binding Errors

**Issue:** `Service binding SVC_DAYCOUNT not found`

**Solution:** Deploy services in dependency order:

```bash
cd iac
make wrangler-deploy-daycount  # Deploy dependencies first
make wrangler-deploy-gateway    # Then gateway
```

### Authentication Errors

**Issue:** `Invalid token signature`

**Solution:** Ensure same `INTERNAL_JWT_SECRET` for all services:

```bash
# Check secrets are set
wrangler secret list --name bond-math-gateway
wrangler secret list --name bond-math-daycount

# Re-set with same value
JWT_SECRET=$(openssl rand -base64 32)
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name bond-math-gateway
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name bond-math-daycount
```

### Custom Domain Not Working

**Issue:** `404 Not Found` on custom domain

**Solution:**

1. Verify DNS is propagated:

```bash
dig bondmath.chrislyons.dev
```

2. Check routes in Cloudflare Dashboard:
   - Workers & Pages → bond-math-gateway → Triggers → Routes

3. Verify Terraform created routes:

```bash
cd iac/tf
terraform show | grep cloudflare_worker_route
```

## Rollback

### Terraform Rollback

```bash
cd iac/tf

# Revert to previous state
terraform state pull > backup.tfstate
terraform state push previous.tfstate

# Or destroy and redeploy
terraform destroy
terraform apply
```

### Wrangler Rollback

```bash
# View deployments
wrangler deployments list --name bond-math-gateway

# Rollback to previous version
wrangler rollback --name bond-math-gateway --message "Rollback to v123"
```

## Performance Optimization

### Cold Start Optimization

- Keep bundle sizes small (<1MB)
- Use tree-shaking for TypeScript
- Minimize Python dependencies

### Caching

Configure Cache-Control headers:

```typescript
return c.json(response, 200, {
  'Cache-Control': 'public, max-age=3600',
});
```

### Rate Limiting

Configure in Gateway worker:

```typescript
rateLimiter({
  windowMs: 60000,
  maxRequests: 100,
});
```

## Security Checklist

Before production deployment:

- [ ] Rotate all secrets from defaults
- [ ] Configure Auth0 with production settings
- [ ] Enable Cloudflare WAF for custom domain
- [ ] Review CORS configuration in Gateway
- [ ] Set up monitoring and alerting
- [ ] Test rate limiting
- [ ] Verify all service bindings use internal JWTs
- [ ] Enable Cloudflare Analytics
- [ ] Configure log retention policy

## Documentation

- [Authentication Setup](./authentication.md)
- [IAC Configuration](../../iac/README.md)
- [Wrangler Configuration](../../iac/workers/README.md)
- [Terraform Configuration](../../iac/tf/README.md)
- [ADR-0003: Cloudflare Hosting](../adr/0003-cloudflare-workers-hosting.md)
- [ADR-0011: Internal JWT](../adr/0011-symmetric-jwt-for-internal-auth.md)

## Support

For deployment issues:

1. Check [Troubleshooting](#troubleshooting)
2. Review Cloudflare Workers logs
3. Check GitHub Issues
4. Contact platform team

---

**Next Steps:** After deployment, configure
[Authentication](./authentication.md)
