.PHONY: help install clean format lint test build deploy arch-docs

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
NC     := \033[0m # No Color

##@ General

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

install: ## Install all dependencies
	@echo "$(GREEN)Installing root dependencies...$(NC)"
	npm install
	@echo "$(GREEN)Installing workspace dependencies...$(NC)"
	npm install --workspaces

clean: ## Clean build artifacts and dependencies
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	npm run clean
	@echo "$(GREEN)Clean complete$(NC)"

format: ## Format all code with Prettier
	@echo "$(GREEN)Formatting code...$(NC)"
	npm run format

format-check: ## Check code formatting
	@echo "$(GREEN)Checking code formatting...$(NC)"
	npm run format:check

lint: ## Lint all code
	@echo "$(GREEN)Linting code...$(NC)"
	npm run lint

##@ Testing

test: ## Run all tests
	@echo "$(GREEN)Running all tests...$(NC)"
	npm run test

test-unit: ## Run unit tests only
	@echo "$(GREEN)Running unit tests...$(NC)"
	npm run test:unit

test-integration: ## Run integration tests only
	@echo "$(GREEN)Running integration tests...$(NC)"
	npm run test:integration

test-e2e: ## Run end-to-end tests
	@echo "$(GREEN)Running E2E tests...$(NC)"
	npm run test:e2e

test-coverage: ## Run tests with coverage report
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	npm run test:coverage

##@ Build & Deploy

build: ## Build all services
	@echo "$(GREEN)Building all services...$(NC)"
	npm run build

dev: ## Start local development servers
	@echo "$(GREEN)Starting development servers...$(NC)"
	npm run dev

deploy: ## Deploy all services to Cloudflare
	@echo "$(GREEN)Deploying to Cloudflare...$(NC)"
	cd iac && make deploy

deploy-preview: ## Deploy to preview environment
	@echo "$(GREEN)Deploying to preview environment...$(NC)"
	cd iac && make deploy-preview

##@ Infrastructure

tf-init: ## Initialize Terraform
	@echo "$(GREEN)Initializing Terraform...$(NC)"
	cd iac/tf && terraform init

tf-plan: ## Run Terraform plan
	@echo "$(GREEN)Running Terraform plan...$(NC)"
	cd iac/tf && terraform plan

tf-apply: ## Apply Terraform changes
	@echo "$(YELLOW)Applying Terraform changes...$(NC)"
	cd iac/tf && terraform apply

##@ Documentation

arch-docs: ## Generate architecture documentation and diagrams
	@echo "$(GREEN)Generating architecture documentation...$(NC)"
	@echo "$(YELLOW)TODO: Implement architecture metadata extraction$(NC)"
	# python scripts/extract-arch-metadata.py
	# python scripts/generate-c4.py

docs-serve: ## Serve documentation locally
	@echo "$(GREEN)Serving documentation...$(NC)"
	@echo "$(YELLOW)TODO: Implement documentation server$(NC)"

##@ Git

commit: ## Interactive commit helper
	@echo "$(GREEN)Preparing commit...$(NC)"
	@echo "$(YELLOW)Ensure you follow Conventional Commits format:$(NC)"
	@echo "  type(scope): subject"
	@echo ""
	@echo "Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, arch"
	@echo "Scopes: gateway, daycount, valuation, metrics, pricing, iac, docs, etc."
	git status

##@ Quick Commands

all: install lint test build ## Install, lint, test, and build
	@echo "$(GREEN)All tasks complete!$(NC)"

ci: format-check lint test-coverage ## Run all CI checks
	@echo "$(GREEN)CI checks complete!$(NC)"
