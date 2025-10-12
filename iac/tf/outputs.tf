# ============================================================================
# Bond Math - Terraform Outputs
# ============================================================================

output "gateway_url" {
  description = "Gateway Worker URL - use this as your API base URL"
  value       = var.domain != "" ? "https://${var.domain}" : "https://${local.gateway_name}.${var.cloudflare_account_id}.workers.dev"
}

output "workers_dev_urls" {
  description = "Direct workers.dev URLs for all services (for testing/debugging)"
  value = {
    gateway    = "https://${local.gateway_name}.${var.cloudflare_account_id}.workers.dev"
    daycount   = "https://${local.daycount_name}.${var.cloudflare_account_id}.workers.dev"
    valuation  = "https://${local.valuation_name}.${var.cloudflare_account_id}.workers.dev"
    metrics    = "https://${local.metrics_name}.${var.cloudflare_account_id}.workers.dev"
    pricing    = "https://${local.pricing_name}.${var.cloudflare_account_id}.workers.dev"
  }
}

output "worker_names" {
  description = "Deployed worker script names"
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

output "custom_domain_configured" {
  description = "Whether custom domain routing is configured"
  value       = var.cloudflare_zone_id != "" && var.domain != ""
}

output "next_steps" {
  description = "Next steps after Terraform deployment"
  value       = <<-EOT

    ✅ Infrastructure deployed successfully!

    📋 Deployment Summary:
    - Environment: ${var.environment}
    - Gateway URL: ${var.domain != "" ? "https://${var.domain}" : "https://${local.gateway_name}.${var.cloudflare_account_id}.workers.dev"}
    - Custom Domain: ${var.domain != "" ? "Configured" : "Not configured (using workers.dev)"}

    🔐 Next Steps - Configure Secrets:

    All services need INTERNAL_JWT_SECRET (same value for all):

    1. Generate a secure secret:
       export JWT_SECRET=$(openssl rand -base64 32)

    2. Set secrets for all workers:
       echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name ${local.gateway_name}
       echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name ${local.daycount_name}
       echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name ${local.valuation_name}
       echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name ${local.metrics_name}
       echo $JWT_SECRET | wrangler secret put INTERNAL_JWT_SECRET --name ${local.pricing_name}

    Gateway also needs Auth0 configuration:
       wrangler secret put AUTH0_DOMAIN --name ${local.gateway_name}
       wrangler secret put AUTH0_AUDIENCE --name ${local.gateway_name}

    🧪 Test the Deployment:
       curl ${var.domain != "" ? "https://${var.domain}" : "https://${local.gateway_name}.${var.cloudflare_account_id}.workers.dev"}/health

    📊 View Logs:
       wrangler tail --name ${local.gateway_name}

    📖 Documentation:
       See docs/reference/deployment.md for complete guide
       See docs/reference/authentication.md for Auth0 setup

  EOT
}
