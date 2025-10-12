.PHONY: help deploy deploy-preview tf-init tf-plan tf-apply tf-destroy wrangler-deploy wrangler-dev

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m # No Color

##@ General

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Terraform

tf-init: ## Initialize Terraform
	@echo "$(GREEN)Initializing Terraform...$(NC)"
	cd tf && terraform init

tf-validate: ## Validate Terraform configuration
	@echo "$(GREEN)Validating Terraform configuration...$(NC)"
	cd tf && terraform validate

tf-plan: ## Run Terraform plan
	@echo "$(GREEN)Running Terraform plan...$(NC)"
	cd tf && terraform plan -out=tfplan

tf-apply: ## Apply Terraform changes
	@echo "$(YELLOW)Applying Terraform changes...$(NC)"
	cd tf && terraform apply tfplan
	@rm -f tf/tfplan

tf-apply-auto: ## Apply Terraform changes without confirmation (CI mode)
	@echo "$(YELLOW)Auto-applying Terraform changes...$(NC)"
	cd tf && terraform apply -auto-approve

tf-destroy: ## Destroy Terraform-managed infrastructure
	@echo "$(RED)WARNING: This will destroy all infrastructure!$(NC)"
	@read -p "Are you sure? Type 'yes' to confirm: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		cd tf && terraform destroy; \
	else \
		echo "Aborted."; \
	fi

tf-output: ## Show Terraform outputs
	@cd tf && terraform output

##@ Wrangler (Workers Deployment)

wrangler-deploy-gateway: ## Deploy Gateway Worker
	@echo "$(GREEN)Deploying Gateway Worker...$(NC)"
	npx wrangler deploy --config workers/gateway.toml

wrangler-deploy-daycount: ## Deploy Day-Count Worker
	@echo "$(GREEN)Deploying Day-Count Worker...$(NC)"
	npx wrangler deploy --config workers/daycount.toml

wrangler-deploy-valuation: ## Deploy Valuation Worker
	@echo "$(GREEN)Deploying Valuation Worker...$(NC)"
	npx wrangler deploy --config workers/valuation.toml

wrangler-deploy-metrics: ## Deploy Metrics Worker
	@echo "$(GREEN)Deploying Metrics Worker...$(NC)"
	npx wrangler deploy --config workers/metrics.toml

wrangler-deploy-pricing: ## Deploy Pricing Engine Worker
	@echo "$(GREEN)Deploying Pricing Engine Worker...$(NC)"
	npx wrangler deploy --config workers/pricing.toml

wrangler-deploy-all: ## Deploy all Workers
	@echo "$(GREEN)Deploying all Workers...$(NC)"
	@$(MAKE) wrangler-deploy-daycount
	@$(MAKE) wrangler-deploy-valuation
	@$(MAKE) wrangler-deploy-metrics
	@$(MAKE) wrangler-deploy-pricing
	@$(MAKE) wrangler-deploy-gateway

wrangler-dev-gateway: ## Start Gateway Worker in local dev mode
	@echo "$(GREEN)Starting Gateway Worker in dev mode...$(NC)"
	npx wrangler dev --config workers/gateway.toml

wrangler-dev-daycount: ## Start Day-Count Worker in local dev mode
	@echo "$(GREEN)Starting Day-Count Worker in dev mode...$(NC)"
	npx wrangler dev --config workers/daycount.toml

##@ Full Deployment

deploy: tf-apply wrangler-deploy-all ## Full deployment: Terraform + all Workers
	@echo "$(GREEN)✓ Full deployment complete!$(NC)"

deploy-preview: ## Deploy to preview environment
	@echo "$(GREEN)Deploying to preview environment...$(NC)"
	cd tf && terraform workspace select preview || terraform workspace new preview
	@$(MAKE) tf-apply-auto
	npx wrangler deploy --env preview --config workers/gateway.toml
	npx wrangler deploy --env preview --config workers/daycount.toml
	@echo "$(GREEN)✓ Preview deployment complete!$(NC)"

##@ Validation

validate: tf-validate ## Validate all infrastructure configuration
	@echo "$(GREEN)Validating Wrangler configurations...$(NC)"
	@for config in workers/*.toml; do \
		echo "Checking $$config..."; \
		npx wrangler deploy --config $$config --dry-run; \
	done
	@echo "$(GREEN)✓ All configurations valid$(NC)"

##@ Utilities

secrets-upload: ## Upload secrets to Workers (interactive)
	@echo "$(YELLOW)Uploading secrets to Workers...$(NC)"
	@echo "This will prompt for each secret value."
	@read -p "Enter AUTH0_DOMAIN: " auth0_domain; \
	npx wrangler secret put AUTH0_DOMAIN --config workers/gateway.toml <<< "$$auth0_domain"
	@read -p "Enter AUTH0_AUDIENCE: " auth0_audience; \
	npx wrangler secret put AUTH0_AUDIENCE --config workers/gateway.toml <<< "$$auth0_audience"
	@read -sp "Enter INTERNAL_JWT_SECRET: " jwt_secret; \
	echo ""; \
	npx wrangler secret put INTERNAL_JWT_SECRET --config workers/gateway.toml <<< "$$jwt_secret"

tail-gateway: ## Tail Gateway Worker logs
	@npx wrangler tail --config workers/gateway.toml

tail-daycount: ## Tail Day-Count Worker logs
	@npx wrangler tail --config workers/daycount.toml

clean: ## Clean deployment artifacts
	@echo "$(YELLOW)Cleaning deployment artifacts...$(NC)"
	@rm -f tf/tfplan
	@rm -rf tf/.terraform
	@echo "$(GREEN)Clean complete$(NC)"
