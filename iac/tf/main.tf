# ============================================================================
# Bond Math - Cloudflare Workers Terraform Configuration
# ============================================================================
#
# This Terraform configuration deploys the Bond Math microservices architecture
# to Cloudflare Workers with proper service bindings and environment configuration.
#
# Architecture:
#   - Gateway Worker (TypeScript) - API entry point with Auth0 verification
#   - Day-Count Worker (TypeScript) - Day count calculations
#   - Bond Valuation Worker (Python) - Price/yield calculations
#   - Metrics Worker (Python) - Duration, convexity, risk metrics
#   - Pricing Worker (Python) - Curve-based cashflow discounting
#
# Usage:
#   terraform init
#   terraform plan
#   terraform apply
#
# See: docs/reference/deployment.md for complete guide
# ============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Uncomment to use remote state (recommended for team collaboration)
  # backend "s3" {
  #   bucket = "bond-math-terraform-state"
  #   key    = "cloudflare/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

# Provider configuration
# Set CLOUDFLARE_API_TOKEN environment variable or use variables
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ============================================================================
# Variables
# ============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers Scripts:Edit permission"
  type        = string
  sensitive   = true
  default     = null # Will use CLOUDFLARE_API_TOKEN env var if not set
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for custom domain (optional)"
  type        = string
  default     = ""
}

variable "domain" {
  description = "Custom domain for the application (e.g., bondmath.chrislyons.dev)"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Environment name (development, preview, production)"
  type        = string
  default     = "production"
}

# ============================================================================
# Locals
# ============================================================================

locals {
  # Environment-specific naming
  env_suffix = var.environment == "production" ? "" : "-${var.environment}"

  # Worker names
  gateway_name    = "bond-math-gateway${local.env_suffix}"
  daycount_name   = "bond-math-daycount${local.env_suffix}"
  valuation_name  = "bond-math-valuation${local.env_suffix}"
  metrics_name    = "bond-math-metrics${local.env_suffix}"
  pricing_name    = "bond-math-pricing${local.env_suffix}"

  # Common tags/labels
  common_tags = {
    Project     = "bond-math"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ============================================================================
# Workers - Deploy in dependency order
# ============================================================================

# Day-Count Worker (no dependencies)
# TypeScript worker for year fraction calculations
resource "cloudflare_worker_script" "daycount" {
  account_id = var.cloudflare_account_id
  name       = local.daycount_name
  content    = file("${path.module}/../../services/daycount/dist/index.js")

  compatibility_date  = "2025-01-01"
  compatibility_flags = ["nodejs_compat"]

  # Enable observability
  logpush = true

  # Environment-specific configuration
  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }

  # Secrets are managed separately via wrangler or Cloudflare API
  # - INTERNAL_JWT_SECRET
}

# Bond Valuation Worker (depends on Day-Count)
# Python worker for price/yield calculations
resource "cloudflare_worker_script" "valuation" {
  account_id = var.cloudflare_account_id
  name       = local.valuation_name
  content    = file("${path.module}/../../services/bond-valuation/dist/index.py")

  compatibility_date = "2025-01-01"
  logpush           = true

  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }

  # Service binding to Day-Count
  service_binding {
    name        = "SVC_DAYCOUNT"
    service     = local.daycount_name
    environment = var.environment
  }

  depends_on = [cloudflare_worker_script.daycount]
}

# Metrics Worker (depends on Valuation and Day-Count)
# Python worker for duration, convexity, risk metrics
resource "cloudflare_worker_script" "metrics" {
  account_id = var.cloudflare_account_id
  name       = local.metrics_name
  content    = file("${path.module}/../../services/metrics/dist/index.py")

  compatibility_date = "2025-01-01"
  logpush           = true

  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }

  # Service bindings
  service_binding {
    name        = "SVC_VALUATION"
    service     = local.valuation_name
    environment = var.environment
  }

  service_binding {
    name        = "SVC_DAYCOUNT"
    service     = local.daycount_name
    environment = var.environment
  }

  depends_on = [
    cloudflare_worker_script.valuation,
    cloudflare_worker_script.daycount
  ]
}

# Pricing Worker (no dependencies)
# Python worker for curve-based cashflow discounting
resource "cloudflare_worker_script" "pricing" {
  account_id = var.cloudflare_account_id
  name       = local.pricing_name
  content    = file("${path.module}/../../services/pricing/dist/index.py")

  compatibility_date = "2025-01-01"
  logpush           = true

  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }
}

# Gateway Worker (depends on all services)
# TypeScript worker for Auth0 verification and routing
resource "cloudflare_worker_script" "gateway" {
  account_id = var.cloudflare_account_id
  name       = local.gateway_name
  content    = file("${path.module}/../../services/gateway/dist/index.js")

  compatibility_date  = "2025-01-01"
  compatibility_flags = ["nodejs_compat"]

  logpush = true

  # Environment configuration
  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }

  plain_text_binding {
    name = "INTERNAL_JWT_TTL"
    text = "90"
  }

  # Service bindings to all backend services
  service_binding {
    name        = "SVC_DAYCOUNT"
    service     = local.daycount_name
    environment = var.environment
  }

  service_binding {
    name        = "SVC_VALUATION"
    service     = local.valuation_name
    environment = var.environment
  }

  service_binding {
    name        = "SVC_METRICS"
    service     = local.metrics_name
    environment = var.environment
  }

  service_binding {
    name        = "SVC_PRICING"
    service     = local.pricing_name
    environment = var.environment
  }

  depends_on = [
    cloudflare_worker_script.daycount,
    cloudflare_worker_script.valuation,
    cloudflare_worker_script.metrics,
    cloudflare_worker_script.pricing
  ]

  # Secrets managed separately:
  # - AUTH0_DOMAIN
  # - AUTH0_AUDIENCE
  # - INTERNAL_JWT_SECRET
}

# ============================================================================
# Custom Domain Routes (Optional)
# ============================================================================

# Only create routes if zone_id and domain are provided
resource "cloudflare_worker_route" "gateway" {
  count = var.cloudflare_zone_id != "" && var.domain != "" ? 1 : 0

  zone_id = var.cloudflare_zone_id
  pattern = "${var.domain}/api/*"
  script_name = cloudflare_worker_script.gateway.name
}

resource "cloudflare_worker_route" "gateway_root" {
  count = var.cloudflare_zone_id != "" && var.domain != "" ? 1 : 0

  zone_id = var.cloudflare_zone_id
  pattern = "${var.domain}/*"
  script_name = cloudflare_worker_script.gateway.name
}

# ============================================================================
# Outputs
# ============================================================================

output "gateway_url" {
  description = "Gateway Worker URL"
  value       = var.domain != "" ? "https://${var.domain}" : "https://${local.gateway_name}.${var.cloudflare_account_id}.workers.dev"
}

output "worker_names" {
  description = "Deployed worker names"
  value = {
    gateway    = local.gateway_name
    daycount   = local.daycount_name
    valuation  = local.valuation_name
    metrics    = local.metrics_name
    pricing    = local.pricing_name
  }
}

output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "next_steps" {
  description = "Next steps after Terraform deployment"
  value       = <<-EOT
    ✓ Infrastructure deployed successfully!

    Next steps:

    1. Set secrets for each worker:
       wrangler secret put INTERNAL_JWT_SECRET --name ${local.gateway_name}
       wrangler secret put AUTH0_DOMAIN --name ${local.gateway_name}
       wrangler secret put AUTH0_AUDIENCE --name ${local.gateway_name}

       wrangler secret put INTERNAL_JWT_SECRET --name ${local.daycount_name}
       wrangler secret put INTERNAL_JWT_SECRET --name ${local.valuation_name}
       wrangler secret put INTERNAL_JWT_SECRET --name ${local.metrics_name}
       wrangler secret put INTERNAL_JWT_SECRET --name ${local.pricing_name}

    2. Test the deployment:
       curl https://${var.domain != "" ? var.domain : "${local.gateway_name}.${var.cloudflare_account_id}.workers.dev"}/health

    3. View logs:
       wrangler tail --name ${local.gateway_name}

    See docs/reference/deployment.md for complete documentation.
  EOT
}
