/**
 * Type definitions for Gateway Worker
 */

/**
 * Cloudflare Worker environment bindings and secrets
 */
export interface Env {
  // Auth0 Configuration
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  AUTH0_ISSUER: string;

  // Internal JWT Configuration
  INTERNAL_JWT_SECRET?: string; // Legacy - for backward compatibility
  INTERNAL_JWT_SECRET_CURRENT?: string; // Current secret (active, used for signing)
  INTERNAL_JWT_SECRET_PREVIOUS?: string; // Previous secret (for zero-downtime rotation)
  INTERNAL_JWT_TTL?: string; // seconds, default 90

  // Environment
  ENVIRONMENT?: string; // production, staging, development

  // Service Bindings
  /**
   * @service-binding SVC_DAYCOUNT
   * @target daycount
   * @purpose Calculate year fractions and accrual days
   */
  SVC_DAYCOUNT: Fetcher;

  /**
   * @service-binding SVC_VALUATION
   * @target bond-valuation
   * @purpose Calculate bond prices and yields
   */
  SVC_VALUATION: Fetcher;

  /**
   * @service-binding SVC_METRICS
   * @target metrics
   * @purpose Calculate duration, convexity, and PV01
   */
  SVC_METRICS: Fetcher;

  /**
   * @service-binding SVC_PRICING
   * @target pricing
   * @purpose Calculate present value of bond cashflows
   */
  SVC_PRICING: Fetcher;
}

/**
 * Auth0 JWKS response structure
 */
export interface JWKS {
  keys: JWK[];
}

/**
 * JSON Web Key structure
 */
export interface JWK {
  kty: string;
  use: string;
  kid: string;
  n: string;
  e: string;
  alg?: string;
  x5c?: string[];
  x5t?: string;
}

/**
 * Auth0 JWT claims (after verification)
 */
export interface Auth0Claims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  scope?: string;
  permissions?: string[];
  // Custom claims (namespaced)
  'https://bondmath.chrislyons.dev/role'?: string;
  'https://bondmath.chrislyons.dev/permissions'?: string[];
  'https://bondmath.chrislyons.dev/user_id'?: string;
  'https://bondmath.chrislyons.dev/org_id'?: string;
}

/**
 * Internal JWT payload structure
 */
export interface InternalJWT {
  iss: string; // "https://gateway.bond-math"
  sub: string; // Service identifier (e.g., "svc-gateway")
  aud: string; // Target service (e.g., "svc-pricing")
  exp: number; // Expiration timestamp
  rid: string; // Request ID for tracing
  act: ActorClaim; // Actor (user) information
}

/**
 * Actor claim - represents "Service X acting for User Y"
 */
export interface ActorClaim {
  iss: string; // Original issuer (Auth0 domain)
  sub: string; // User ID from Auth0
  role?: string; // User role (free, professional, admin, service)
  perms: string[]; // User permissions/scopes
  org?: string; // Organization ID
  uid?: string; // Internal user ID
}

/**
 * RFC 7807 Problem Details error response
 */
export interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

/**
 * Service route mapping
 */
export interface ServiceRoute {
  prefix: string;
  binding: keyof Env;
  stripPrefix: boolean;
}

/**
 * Hono context variables
 */
export interface Variables {
  requestId: string;
  userId?: string;
}
