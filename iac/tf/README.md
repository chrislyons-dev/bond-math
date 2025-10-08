# Terraform Configuration for Bond Math

Infrastructure as Code for deploying Bond Math microservices to Cloudflare
Workers.

## Overview

This Terraform configuration deploys the complete Bond Math architecture:

- **Gateway Worker** (TypeScript) - API gateway with Auth0 verification
- **Day-Count Worker** (TypeScript) - Year fraction calculations
- **Bond Valuation Worker** (Python) - Price/yield calculations
- **Metrics Worker** (Python) - Duration, convexity, risk metrics
- **Pricing Worker** (Python) - Curve-based cashflow discounting

All services are deployed with proper service bindings for zero-trust internal
communication.

## Prerequisites

1. **Cloudflare Account**
   - Active Cloudflare account with Workers enabled
   - Account ID (found in Dashboard)

2. **API Token**
   - Create at: Cloudflare Dashboard → My Profile → API Tokens
   - Required permission: `Account.Workers Scripts:Edit`

3. **Tools**
   - Terraform >= 1.0
   - Wrangler CLI (for secrets management)
   - Build artifacts in `services/*/dist/`

## Quick Start

### 1. Configure Credentials

```bash
# Option A: Use terraform.tfvars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your Cloudflare credentials

# Option B: Use environment variables
export CLOUDFLARE_API_TOKEN="your-token"
export TF_VAR_cloudflare_account_id="your-account-id"
```

### 2. Build Services

Before deploying, build all services:

```bash
# TypeScript services
cd ../../services/gateway && npm run build
cd ../daycount && npm run build

# Python services
cd ../bond-valuation && npm run build
cd ../metrics && npm run build
cd ../pricing && npm run build
```

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Preview Changes

```bash
terraform plan
```

### 5. Deploy

```bash
terraform apply
```

### 6. Configure Secrets

After Terraform completes, set secrets for each worker:

```bash
# Generate shared secret
export JWT_SECRET=$(openssl rand -base64 32)

# Set for all workers (use same value!)
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name bond-math-gateway
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name bond-math-daycount
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name bond-math-valuation
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name bond-math-metrics
echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name bond-math-pricing

# Set Auth0 credentials (Gateway only)
wrangler secret put AUTH0_DOMAIN --name bond-math-gateway
wrangler secret put AUTH0_AUDIENCE --name bond-math-gateway
```

## Configuration

### Required Variables

| Variable                | Description           | Example     |
| ----------------------- | --------------------- | ----------- |
| `cloudflare_account_id` | Cloudflare Account ID | `abc123...` |

### Optional Variables

| Variable               | Description                | Default        |
| ---------------------- | -------------------------- | -------------- |
| `cloudflare_api_token` | API token (or use env var) | `null`         |
| `cloudflare_zone_id`   | Zone ID for custom domain  | `""`           |
| `domain`               | Custom domain              | `""`           |
| `environment`          | Environment name           | `"production"` |

### Custom Domain Setup

To use a custom domain (e.g., `bondmath.chrislyons.dev`):

1. Add domain to Cloudflare
2. Get Zone ID from Dashboard
3. Set variables in `terraform.tfvars`:

```hcl
cloudflare_zone_id = "your-zone-id"
domain = "bondmath.chrislyons.dev"
```

## Environments

### Production

```bash
terraform apply
```

Workers deployed as: `bond-math-*`

### Preview

```bash
terraform workspace new preview
terraform apply -var="environment=preview"
```

Workers deployed as: `bond-math-*-preview`

### Development

```bash
terraform workspace new development
terraform apply -var="environment=development"
```

Workers deployed as: `bond-math-*-development`

## Common Commands

### Deployment

```bash
# Full deployment
make deploy

# Preview environment
make deploy-preview

# Terraform only
make tf-apply
```

### Validation

```bash
# Validate configuration
terraform validate

# Check formatting
terraform fmt -check

# Validate all configs
make validate
```

### Secrets Management

```bash
# List secrets for a worker
wrangler secret list --name bond-math-gateway

# Update a secret
wrangler secret put INTERNAL_JWT_SECRET --name bond-math-gateway

# Delete a secret
wrangler secret delete INTERNAL_JWT_SECRET --name bond-math-gateway
```

### Monitoring

```bash
# View logs
wrangler tail --name bond-math-gateway

# View metrics
terraform output

# Test deployment
curl $(terraform output -raw gateway_url)/health
```

## File Structure

```
tf/
├── main.tf                    # Main infrastructure definition
├── variables.tf               # Input variables
├── outputs.tf                 # Output values
├── terraform.tfvars.example   # Example configuration
├── .gitignore                 # Git ignore rules
└── README.md                  # This file

# Gitignored files:
├── terraform.tfvars           # Your credentials (created from .example)
├── .terraform/                # Terraform plugins
├── terraform.tfstate          # State file
└── tfplan                     # Plan file
```

## Deployment Order

Services are deployed in dependency order:

1. **Day-Count** (no dependencies)
2. **Valuation** (depends on Day-Count)
3. **Metrics** (depends on Valuation, Day-Count)
4. **Pricing** (no dependencies)
5. **Gateway** (depends on all)

Terraform handles this automatically via `depends_on`.

## Troubleshooting

### "No such file" error for dist/index.js

**Solution:** Build services before deploying:

```bash
cd ../../services/gateway && npm run build
cd ../daycount && npm run build
# ... build other services
```

### "Invalid API token"

**Solution:** Verify token has correct permissions:

```bash
# Test token
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify
```

### "Service binding not found"

**Solution:** Deploy workers in dependency order (Terraform does this
automatically).

### State file conflicts

**Solution:** Use remote state for team collaboration:

```hcl
# In main.tf
terraform {
  backend "s3" {
    bucket = "bond-math-terraform-state"
    key    = "cloudflare/terraform.tfstate"
    region = "us-east-1"
  }
}
```

## Security Best Practices

✅ **DO:**

- Use `terraform.tfvars` for credentials (gitignored)
- Set `CLOUDFLARE_API_TOKEN` environment variable
- Use Wrangler for secrets management
- Rotate secrets every 90 days
- Use different secrets per environment

❌ **DON'T:**

- Commit `terraform.tfvars` to git
- Store secrets in Terraform state
- Share API tokens via email/Slack
- Reuse development secrets in production

## CI/CD Integration

### GitHub Actions Example

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

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Build services
        run: npm run build

      - name: Terraform Init
        run: cd iac/tf && terraform init
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Terraform Apply
        run: cd iac/tf && terraform apply -auto-approve
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          TF_VAR_cloudflare_account_id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Documentation

- [Deployment Guide](../../docs/reference/deployment.md)
- [Authentication Setup](../../docs/reference/authentication.md)
- [ADR-0003: Cloudflare Hosting](../../docs/adr/0003-cloudflare-workers-hosting.md)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review [Documentation](#documentation)
3. File an issue on GitHub

---

**Important:** Terraform manages infrastructure only. Secrets must be set
separately via Wrangler CLI.
