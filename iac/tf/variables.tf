# ============================================================================
# Bond Math - Terraform Variables
# ============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers Scripts:Edit permission"
  type        = string
  sensitive   = true
  default     = null # Will use CLOUDFLARE_API_TOKEN env var if not set
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID (found in Cloudflare Dashboard)"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for custom domain routing (optional - leave empty to use workers.dev subdomain)"
  type        = string
  default     = ""
}

variable "domain" {
  description = "Custom domain for the Gateway Worker (e.g., bondmath.chrislyons.dev). Leave empty to use workers.dev subdomain"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Deployment environment - affects worker naming and configuration"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "preview", "production"], var.environment)
    error_message = "Environment must be one of: development, preview, production"
  }
}
