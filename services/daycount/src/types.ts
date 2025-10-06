/**
 * Day-count convention types for Bond Math
 *
 * @module types
 */

/**
 * Supported day-count conventions
 */
export type DayCountConvention =
  | '30_360' // U.S. 30/360 (Bond Basis)
  | '30E_360' // European 30E/360 (Eurobond Basis)
  | 'ACT_360' // Actual/360
  | 'ACT_365F' // Actual/365 Fixed
  | 'ACT_ACT_ISDA' // Actual/Actual ISDA
  | 'ACT_ACT_ICMA'; // Actual/Actual ICMA

/**
 * Date pair for year fraction calculation
 */
export interface DatePair {
  /** Start date in ISO 8601 format (YYYY-MM-DD) */
  start: string;

  /** End date in ISO 8601 format (YYYY-MM-DD) */
  end: string;
}

/**
 * Options for day-count calculations
 */
export interface DayCountOptions {
  /** Apply end-of-month rule (default: false) */
  eomRule?: boolean;

  /** Coupon frequency for ACT/ACT ICMA (default: 2 for semi-annual) */
  frequency?: number;
}

/**
 * Request body for /api/daycount/v1/count endpoint
 */
export interface DayCountRequest {
  /** Array of date pairs to calculate */
  pairs: DatePair[];

  /** Day count convention code */
  convention: DayCountConvention;

  /** Optional calculation parameters */
  options?: DayCountOptions;

  /** API version (for compatibility tracking) */
  version?: string;
}

/**
 * Single day-count calculation result
 */
export interface DayCountResult {
  /** Number of accrual days */
  days: number;

  /** Year fraction (days / basis) */
  yearFraction: number;

  /** Denominator used in calculation */
  basis: number;
}

/**
 * Response body for /api/daycount/v1/count endpoint
 */
export interface DayCountResponse {
  /** Array of calculation results matching the input pairs */
  results: DayCountResult[];

  /** Convention used for calculations */
  convention: DayCountConvention;

  /** Service version */
  version: string;
}

/**
 * Standard error response following RFC 7807 Problem Details
 */
export interface ErrorResponse {
  /** URI reference identifying the problem type */
  type: string;

  /** Short human-readable title */
  title: string;

  /** HTTP status code */
  status: number;

  /** Human-readable explanation */
  detail: string;

  /** URI reference identifying the specific occurrence */
  instance?: string;

  /** Additional error metadata */
  errors?: Array<{
    field?: string;
    message: string;
  }>;
}

/**
 * Parsed date components for calculations
 *
 * @internal
 */
export interface DateComponents {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/**
 * Actor claim from internal JWT
 * Represents "Service X acting for User Y"
 */
export interface ActorClaim {
  /** Original issuer (Auth0 domain) */
  iss: string;
  /** User ID from Auth0 */
  sub: string;
  /** User role (free, professional, admin, service) */
  role?: string;
  /** User permissions/scopes */
  perms: string[];
  /** Organization ID */
  org?: string;
  /** Internal user ID */
  uid?: string;
}

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  /** Internal JWT signing/verification secret */
  INTERNAL_JWT_SECRET: string;
  /** Environment name (development, preview, production) */
  ENVIRONMENT?: string;
}
