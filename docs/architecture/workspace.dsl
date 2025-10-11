workspace "bond-math" "Architecture as Code generated workspace" {

    model {
        # External actors
        user = person "User" "End user accessing the bond calculation system"
        auth0 = softwareSystem "Auth0" "OAuth2/OIDC identity provider" "External"
        cloudflare = softwareSystem "Cloudflare Platform" "Edge computing platform" "External"

        # Bond Math System
        bondMath = softwareSystem "bond-math" {
            description "Multi-language, serverless microservices system for fixed-income pricing and metrics"

            # Services (Containers)
            bond_valuation = container "Bond Valuation" {
                description "Price ↔ yield calculations and cashflow generation for bullet bonds"
                technology "Cloudflare Workers (Python)"
                tags "Business Logic,SLA:high,Python"

                # Components
                bond_valuation_main = component "main" {
                    description "Module: main"
                    technology "Python Module"
                }
            }
            daycount = container "Daycount" {
                description "Authoritative day-count and year-fraction calculations for fixed income"
                technology "Cloudflare Workers (TypeScript)"
                tags "Business Logic,SLA:high,TypeScript"

                # Components
                daycount_ActorClaim = component "ActorClaim" {
                    description "Actor claim from internal JWT Represents \"Service X acting for User Y\""
                    technology "TypeScript Interface"
                }
                daycount_DateComponents = component "DateComponents" {
                    description "Parsed date components for calculations"
                    technology "TypeScript Interface"
                }
                daycount_DatePair = component "DatePair" {
                    description "Date pair for year fraction calculation"
                    technology "TypeScript Interface"
                }
                daycount_DayCountOptions = component "DayCountOptions" {
                    description "Options for day-count calculations"
                    technology "TypeScript Interface"
                }
                daycount_DayCountRequest = component "DayCountRequest" {
                    description "Request body for /api/daycount/v1/count endpoint"
                    technology "TypeScript Interface"
                }
                daycount_DayCountResponse = component "DayCountResponse" {
                    description "Response body for /api/daycount/v1/count endpoint"
                    technology "TypeScript Interface"
                }
                daycount_DayCountResult = component "DayCountResult" {
                    description "Single day-count calculation result"
                    technology "TypeScript Interface"
                }
                daycount_Env = component "Env" {
                    description "Cloudflare Worker environment bindings"
                    technology "TypeScript Interface"
                }
                daycount_ErrorResponse = component "ErrorResponse" {
                    description "Standard error response following RFC 7807 Problem Details"
                    technology "TypeScript Interface"
                }
                daycount_index = component "index" {
                    description "Module: index"
                    technology "TypeScript Interface"
                }
                daycount_logger = component "logger" {
                    description "Module: logger"
                    technology "TypeScript Interface"
                }
                daycount_scopes = component "scopes" {
                    description "Module: scopes"
                    technology "TypeScript Interface"
                }
                daycount_utils = component "utils" {
                    description "Module: utils"
                    technology "TypeScript Interface"
                }
                daycount_ValidationError = component "ValidationError" {
                    description "Validation error with field context"
                    technology "TypeScript Interface"
                }
                daycount_validators = component "validators" {
                    description "Module: validators"
                    technology "TypeScript Interface"
                }
                daycount_Variables = component "Variables" {
                    description "Hono context variables"
                    technology "TypeScript Interface"
                }

                # Component relationships
                daycount_DayCountRequest -> daycount_DatePair "Uses"
                daycount_DayCountRequest -> daycount_DayCountOptions "Uses"
                daycount_DayCountResponse -> daycount_DayCountResult "Uses"
                daycount_Variables -> daycount_ActorClaim "Uses"
            }
            gateway = container "Gateway" {
                description "Entry point for all API traffic - handles Auth0 verification, internal JWT minting, and service routing"
                technology "Cloudflare Workers (TypeScript)"
                tags "API Gateway,SLA:critical,TypeScript"

                # Components
                gateway_ActorClaim = component "ActorClaim" {
                    description "Actor claim - represents \"Service X acting for User Y\""
                    technology "TypeScript Interface"
                }
                gateway_Auth0Claims = component "Auth0Claims" {
                    description "Auth0 JWT claims (after verification)"
                    technology "TypeScript Interface"
                }
                gateway_Env = component "Env" {
                    description "Type definitions for Gateway Worker"
                    technology "TypeScript Interface"
                }
                gateway_ErrorResponse = component "ErrorResponse" {
                    description "RFC 7807 Problem Details error response"
                    technology "TypeScript Interface"
                }
                gateway_InternalJWT = component "InternalJWT" {
                    description "Internal JWT payload structure"
                    technology "TypeScript Interface"
                }
                gateway_JWK = component "JWK" {
                    description "JSON Web Key structure"
                    technology "TypeScript Interface"
                }
                gateway_JWKS = component "JWKS" {
                    description "Auth0 JWKS response structure"
                    technology "TypeScript Interface"
                }
                gateway_jwt = component "jwt" {
                    description "Module: jwt"
                    technology "TypeScript Interface"
                }
                gateway_logger = component "logger" {
                    description "Module: logger"
                    technology "TypeScript Interface"
                }
                gateway_middleware = component "middleware" {
                    description "Module: middleware"
                    technology "TypeScript Interface"
                }
                gateway_router = component "router" {
                    description "Module: router"
                    technology "TypeScript Interface"
                }
                gateway_ServiceRoute = component "ServiceRoute" {
                    description "Service route mapping"
                    technology "TypeScript Interface"
                }
                gateway_Variables = component "Variables" {
                    description "Hono context variables"
                    technology "TypeScript Interface"
                }

                # Component relationships
                gateway_InternalJWT -> gateway_ActorClaim "Uses"
                gateway_JWKS -> gateway_JWK "Uses"
            }
            metrics = container "Metrics" {
                description "Bond risk metrics (duration, convexity, PV01, DV01)"
                technology "Cloudflare Workers (Python)"
                tags "Business Logic,SLA:high,Python"

                # Components
                metrics_main = component "main" {
                    description "Module: main"
                    technology "Python Module"
                }
            }
            pricing = container "Pricing" {
                description "Curve-based cashflow discounting and present value calculations"
                technology "Cloudflare Workers (Python)"
                tags "Business Logic,SLA:high,Python"

                # Components
                pricing_main = component "main" {
                    description "Module: main"
                    technology "Python Module"
                }
            }

            # Service-to-service relationships
            gateway -> bond_valuation "Uses" "Service Binding (internal-jwt)"
            gateway -> daycount "Uses" "Service Binding (internal-jwt)"
            gateway -> metrics "Uses" "Service Binding (internal-jwt)"
            gateway -> pricing "Uses" "Service Binding (internal-jwt)"
        }

        # User interactions
        user -> bondMath "Uses" "HTTPS"
        user -> auth0 "Authenticates with" "OAuth2/OIDC"

        # System integrations
        bondMath -> auth0 "Verifies tokens" "HTTPS"
        cloudflare -> bondMath "Hosts" "Cloudflare Workers"

        # Deployment environments
        deploymentEnvironment "Development" {
            deploymentNode "bond-math-gateway-dev" {
                technology "Cloudflare Workers"
                containerInstance gateway
            }
        }
        deploymentEnvironment "Preview" {
            deploymentNode "bond-math-ui" {
                technology "Cloudflare Workers"
                containerInstance ui
            }
            deploymentNode "bond-math-gateway-preview" {
                technology "Cloudflare Workers"
                containerInstance gateway
            }
            deploymentNode "bond-math-daycount-preview" {
                technology "Cloudflare Workers"
                containerInstance daycount
            }
            deploymentNode "bond-math-valuation-preview" {
                technology "Cloudflare Workers"
                containerInstance bond_valuation
            }
            deploymentNode "bond-math-metrics-preview" {
                technology "Cloudflare Workers"
                containerInstance metrics
            }
            deploymentNode "bond-math-pricing-preview" {
                technology "Cloudflare Workers"
                containerInstance pricing
            }
        }
        deploymentEnvironment "Production" {
            deploymentNode "bond-math-ui" {
                technology "Cloudflare Workers"
                containerInstance ui
            }
            deploymentNode "bond-math-gateway" {
                technology "Cloudflare Workers"
                containerInstance gateway
            }
            deploymentNode "bond-math-daycount" {
                technology "Cloudflare Workers"
                containerInstance daycount
            }
            deploymentNode "bond-math-valuation" {
                technology "Cloudflare Workers"
                containerInstance bond_valuation
            }
            deploymentNode "bond-math-metrics" {
                technology "Cloudflare Workers"
                containerInstance metrics
            }
            deploymentNode "bond-math-pricing" {
                technology "Cloudflare Workers"
                containerInstance pricing
            }
        }
    }

    views {
        systemContext bondMath "SystemContext" {
            include *
            autoLayout
            description "System context diagram for Bond Math system"
            title "Bond Math - System Context"
        }

        container bondMath "Containers" {
            include *
            autoLayout
            description "Container diagram showing all microservices"
            title "Bond Math - Containers"
        }

        component bond_valuation "Components_bond_valuation" {
            include *
            autoLayout
            description "Component diagram for Bond Valuation"
            title "Bond Valuation - Components"
        }
        component daycount "Components_daycount" {
            include *
            autoLayout
            description "Component diagram for Daycount"
            title "Daycount - Components"
        }
        component gateway "Components_gateway" {
            include *
            autoLayout
            description "Component diagram for Gateway"
            title "Gateway - Components"
        }
        component metrics "Components_metrics" {
            include *
            autoLayout
            description "Component diagram for Metrics"
            title "Metrics - Components"
        }
        component pricing "Components_pricing" {
            include *
            autoLayout
            description "Component diagram for Pricing"
            title "Pricing - Components"
        }

        deployment * "Development" "Deployment_development" {
            include *
            autoLayout
            description "Deployment diagram for Development environment"
            title "Bond Math - Development Deployment"
        }

        deployment * "Preview" "Deployment_preview" {
            include *
            autoLayout
            description "Deployment diagram for Preview environment"
            title "Bond Math - Preview Deployment"
        }

        deployment * "Production" "Deployment_production" {
            include *
            autoLayout
            description "Deployment diagram for Production environment"
            title "Bond Math - Production Deployment"
        }

        styles {
            element "External" {
                background #999999
                color #ffffff
            }

            element "API Gateway" {
                background #FF6B35
                color #ffffff
            }

            element "Business Logic" {
                background #004E89
                color #ffffff
            }

            element "TypeScript" {
                background #3178C6
                color #ffffff
            }

            element "Python" {
                background #3776AB
                color #ffffff
            }

            element "Person" {
                shape Person
                background #08457E
                color #ffffff
            }
        }
    }

}
