# Infrastructure as Code (IAC)

Infrastructure configuration for deploying Bond Math to Cloudflare Workers.

## Overview

This directory contains all infrastructure-as-code for the Bond Math project:

- **Wrangler Configurations** (`workers/`) - Cloudflare Workers deployment
  configs
- **Terraform** (`tf/`) - Infrastructure provisioning and management
- **Makefile** - Deployment automation scripts

## Structure

```
iac/
├── workers/                   # Wrangler configurations
│   ├── gateway.toml          # Gateway Worker config
│   ├── daycount.toml         # Day-Count Worker config
│   ├── valuation.toml        # Valuation Worker config
│   ├── metrics.toml          # Metrics Worker config
│   ├── pricing.toml          # Pricing Worker config
│   ├── .dev.vars.example     # Local secrets template
│   └── README.md             # Wrangler documentation
│
├── tf/                        # Terraform configuration
│   ├── main.tf               # Main infrastructure
│   ├── variables.tf          # Input variables
│   ├── outputs.tf            # Output values
│   ├── terraform.tfvars.example  # Configuration template
│   ├── .gitignore            # Terraform gitignore
│   └── README.md             # Terraform documentation
│
├── Makefile                   # Deployment automation
└── README.md                  # This file
```

## Quick Start

### Option 1: Wrangler Only (Development)

```bash
# 1. Configure local secrets
cp workers/.dev.vars.example workers/.dev.vars
# Edit .dev.vars with your values

# 2. Deploy all services
make wrangler-deploy-all
```

### Option 2: Terraform + Wrangler (Production)

```bash
# 1. Build services
cd .. && npm run build --workspaces

# 2. Configure Terraform
cd iac/tf
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with Cloudflare credentials

# 3. Deploy infrastructure
make deploy
```

## Deployment Methods

### Wrangler (Direct Deployment)

**Use when:**

- Local development
- Quick iterations
- Single service updates
- Testing changes

**Pros:**

- Fast deployment
- Simple configuration
- Direct control
- Good for development

**Cons:**

- Manual service binding management
- No infrastructure state
- No dependency ordering

**Commands:**

```bash
# Deploy individual service
make wrangler-deploy-gateway

# Deploy all services
make wrangler-deploy-all

# Start local dev server
make wrangler-dev-gateway
```

### Terraform (Infrastructure as Code)

**Use when:**

- Production deployment
- Team collaboration
- Infrastructure versioning
- Automated pipelines

**Pros:**

- Infrastructure as Code
- State management
- Automated dependencies
- Repeatable deployments
- Version control

**Cons:**

- More complex setup
- Requires build artifacts
- Slower iteration

**Commands:**

```bash
# Full deployment (Terraform + Wrangler)
make deploy

# Terraform only
make tf-init
make tf-plan
make tf-apply

# Preview environment
make deploy-preview
```

## Common Workflows

### First-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure local secrets
cp workers/.dev.vars.example workers/.dev.vars
nano workers/.dev.vars

# 3. Build all services
cd .. && npm run build --workspaces

# 4. Choose deployment method
# Option A: Wrangler (development)
make wrangler-deploy-all

# Option B: Terraform (production)
make deploy
```

### Update a Single Service

```bash
# 1. Build service
cd ../services/gateway && npm run build

# 2. Deploy
cd ../../iac
make wrangler-deploy-gateway
```

### Deploy to Preview Environment

```bash
# 1. Build services
npm run build --workspaces

# 2. Deploy to preview
cd iac
make deploy-preview
```

### View Logs

```bash
# Gateway logs
make tail-gateway

# Day-Count logs
make tail-daycount
```

## Configuration

### Environment Variables

Set in `workers/*.toml` files:

```toml
[vars]
ENVIRONMENT = "production"
INTERNAL_JWT_TTL = "90"
```

### Secrets

Set via Wrangler CLI (never in config files):

```bash
# Local development
# Edit workers/.dev.vars

# Production
wrangler secret put INTERNAL_JWT_SECRET --config workers/gateway.toml
```

### Service Bindings

Defined in `workers/gateway.toml`:

```toml
[[services]]
binding = "SVC_DAYCOUNT"
service = "bond-math-daycount"
environment = "production"
```

## Environments

### Development (Local)

- Uses `.dev.vars` for secrets
- Service bindings point to local instances
- Run with `npm run dev`

### Preview

- Deployed to Cloudflare with `-preview` suffix
- Separate secrets from production
- Deploy with `make deploy-preview`

### Production

- Default environment
- Production secrets from Wrangler
- Deploy with `make deploy`

## Deployment Order

Services must be deployed in dependency order:

```
1. Day-Count      (no dependencies)
2. Valuation      (depends on Day-Count)
3. Metrics        (depends on Valuation, Day-Count)
4. Pricing        (no dependencies)
5. Gateway        (depends on all)
```

**Note:** Terraform handles this automatically. Wrangler requires manual
ordering.

## Make Targets

### Deployment

| Command                          | Description                               |
| -------------------------------- | ----------------------------------------- |
| `make deploy`                    | Full deployment (Terraform + all Workers) |
| `make deploy-preview`            | Deploy to preview environment             |
| `make wrangler-deploy-all`       | Deploy all Workers via Wrangler           |
| `make wrangler-deploy-gateway`   | Deploy Gateway Worker                     |
| `make wrangler-deploy-daycount`  | Deploy Day-Count Worker                   |
| `make wrangler-deploy-valuation` | Deploy Valuation Worker                   |
| `make wrangler-deploy-metrics`   | Deploy Metrics Worker                     |
| `make wrangler-deploy-pricing`   | Deploy Pricing Worker                     |

### Terraform

| Command            | Description               |
| ------------------ | ------------------------- |
| `make tf-init`     | Initialize Terraform      |
| `make tf-validate` | Validate Terraform config |
| `make tf-plan`     | Run Terraform plan        |
| `make tf-apply`    | Apply Terraform changes   |
| `make tf-destroy`  | Destroy infrastructure    |
| `make tf-output`   | Show Terraform outputs    |

### Development

| Command                      | Description             |
| ---------------------------- | ----------------------- |
| `make wrangler-dev-gateway`  | Start Gateway locally   |
| `make wrangler-dev-daycount` | Start Day-Count locally |
| `make tail-gateway`          | View Gateway logs       |
| `make tail-daycount`         | View Day-Count logs     |

### Utilities

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `make validate`       | Validate all configurations  |
| `make secrets-upload` | Upload secrets interactively |
| `make clean`          | Clean deployment artifacts   |
| `make help`           | Show all available commands  |

## Secrets Management

### Required Secrets

| Secret                | Services | Generate With             |
| --------------------- | -------- | ------------------------- |
| `INTERNAL_JWT_SECRET` | All      | `openssl rand -base64 32` |
| `AUTH0_DOMAIN`        | Gateway  | From Auth0 Dashboard      |
| `AUTH0_AUDIENCE`      | Gateway  | From Auth0 Dashboard      |

### Setting Secrets

**Local Development:**

```bash
# Edit .dev.vars file
nano workers/.dev.vars
```

**Production:**

```bash
# Interactive
make secrets-upload

# Manual
wrangler secret put INTERNAL_JWT_SECRET --config workers/gateway.toml
```

**Important:** Use the **same** `INTERNAL_JWT_SECRET` for all services!

## Service Architecture

```
┌─────────────────────────────────────────────┐
│                   Gateway                    │
│            (TypeScript Worker)               │
│  - Auth0 verification                        │
│  - Internal JWT minting                      │
│  - Request routing                           │
└─────────┬───────────────────────────────────┘
          │
    ┌─────┴─────┬──────────┬──────────┐
    │           │          │          │
    ▼           ▼          ▼          ▼
┌────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐
│ Day-   │ │ Valuation│ │Metrics │ │ Pricing │
│ Count  │ │          │ │        │ │         │
│   TS   │ │  Python  │ │ Python │ │ Python  │
└────────┘ └─────┬────┘ └───┬────┘ └─────────┘
              │         │
              └─────────┘
                  │
              ┌───▼──────┐
              │ Day-Count│
              └──────────┘
```

## Troubleshooting

### Build Errors

```bash
# Ensure services are built
cd .. && npm run build --workspaces
```

### Service Binding Errors

```bash
# Deploy in dependency order
make wrangler-deploy-daycount
make wrangler-deploy-valuation
make wrangler-deploy-gateway
```

### Secret Errors

```bash
# Verify secrets are set
wrangler secret list --config workers/gateway.toml

# Re-set if missing
wrangler secret put INTERNAL_JWT_SECRET --config workers/gateway.toml
```

### Terraform State Issues

```bash
# Reinitialize
cd tf && terraform init -reconfigure

# Or use remote state (recommended for teams)
```

## Security Best Practices

✅ **DO:**

- Use `.dev.vars` for local development (gitignored)
- Use Wrangler secrets for production
- Generate secrets with `openssl rand -base64 32`
- Use same `INTERNAL_JWT_SECRET` across all services
- Rotate secrets every 90 days
- Use different secrets per environment

❌ **DON'T:**

- Commit `.dev.vars` or `terraform.tfvars` to git (already gitignored)
- Store secrets in TOML files
- Share secrets via email/Slack
- Reuse development secrets in production
- Use weak/guessable secrets

## Documentation

- **[Deployment Guide](../docs/reference/deployment.md)** - Complete deployment
  walkthrough
- **[Wrangler Configs](./workers/README.md)** - Wrangler configuration details
- **[Terraform Setup](./tf/README.md)** - Terraform infrastructure guide
- **[Authentication](../docs/reference/authentication.md)** - Auth0 and JWT
  setup
- **[ADR-0003](../docs/adr/0003-cloudflare-workers-hosting.md)** - Hosting
  decision
- **[ADR-0011](../docs/adr/0011-symmetric-jwt-for-internal-auth.md)** - Internal
  auth

## CI/CD Integration

See [Deployment Guide](../docs/reference/deployment.md#cicd-integration) for
GitHub Actions examples.

## Support

For deployment issues:

1. Check [Troubleshooting](#troubleshooting)
2. Review [Deployment Guide](../docs/reference/deployment.md)
3. Check Cloudflare Workers logs: `make tail-gateway`
4. File an issue on GitHub

---

**Quick Links:**

- [Build Services](../README.md#build)
- [Run Locally](../README.md#development)
- [Deploy to Production](#option-2-terraform--wrangler-production)
