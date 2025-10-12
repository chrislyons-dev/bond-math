/**
 * API Client for Bond Math services
 *
 * @module api-client
 * @layer client
 * @description Type-safe HTTP client for Gateway API with Auth0 bearer token injection
 * @owner platform-team
 * @dependencies svc-gateway (via HTTPS)
 * @security-model auth0-bearer-token
 *
 * Provides type-safe interfaces and functions for calling backend services
 * through the Gateway. Handles automatic API base URL detection, bearer
 * token injection, and field-level error mapping.
 */

/**
 * Date pair for day count calculations.
 *
 * @property start - ISO 8601 start date (YYYY-MM-DD)
 * @property end - ISO 8601 end date (YYYY-MM-DD)
 */
export interface DatePair {
  start: string;
  end: string;
}

/**
 * Supported day count conventions for fixed income calculations.
 *
 * @see https://en.wikipedia.org/wiki/Day_count_convention
 */
export type DayCountConvention =
  | '30_360' // U.S. 30/360 Bond Basis
  | '30E_360' // European 30E/360
  | 'ACT_360' // Actual/360 (Money Market)
  | 'ACT_365F' // Actual/365 Fixed
  | 'ACT_ACT_ISDA' // Actual/Actual ISDA
  | 'ACT_ACT_ICMA'; // Actual/Actual ICMA

/**
 * Optional parameters for day count calculations.
 *
 * @property eomRule - End-of-month rule (30/360 conventions)
 * @property frequency - Payment frequency per year (ACT/ACT ICMA)
 */
export interface DayCountOptions {
  eomRule?: boolean;
  frequency?: number;
}

/**
 * Request payload for day count calculations.
 *
 * @property pairs - Array of date pairs to calculate
 * @property convention - Day count convention to use
 * @property options - Optional calculation parameters
 */
export interface DayCountRequest {
  pairs: DatePair[];
  convention: DayCountConvention;
  options?: DayCountOptions;
}

/**
 * Result of a single day count calculation.
 *
 * @property days - Number of days between dates
 * @property yearFraction - Year fraction (days / basis)
 * @property basis - Denominator used for calculation
 */
export interface DayCountResult {
  days: number;
  yearFraction: number;
  basis: number;
}

/**
 * Response from day count calculation endpoint.
 *
 * @property results - Array of calculation results (one per input pair)
 * @property convention - Convention used for calculations
 * @property version - Service version that processed the request
 */
export interface DayCountResponse {
  results: DayCountResult[];
  convention: DayCountConvention;
  version: string;
}

/**
 * RFC 7807 Problem Details error response.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Array<{
    field?: string;
    message: string;
  }>;
}

/**
 * Custom error class for API errors with field-level validation details.
 *
 * Extends Error with HTTP status code and optional field-level errors
 * from RFC 7807 Problem Details responses.
 *
 * @example
 * ```typescript
 * try {
 *   await calculateDayCount(request, token);
 * } catch (err) {
 *   if (err instanceof ApiError) {
 *     console.error(`API error ${err.status}: ${err.message}`);
 *     err.errors?.forEach(e => console.error(`  ${e.field}: ${e.message}`));
 *   }
 * }
 * ```
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: ErrorResponse['errors']
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Get API base URL with automatic environment detection.
 *
 * Strategy:
 * - Browser: Use same origin (window.location.origin) for same-site requests
 * - SSR/Build: Use PUBLIC_API_BASE_URL env var or production URL fallback
 *
 * This enables seamless local dev (localhost:4321 → localhost:8787) and
 * production deployment (bondmath.chrislyons.dev → bondmath.chrislyons.dev).
 *
 * @returns API base URL without trailing slash
 */
function getApiBaseUrl(): string {
  // In browser, use same origin for API calls
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // During SSR/build, use env var or production URL
  return import.meta.env.PUBLIC_API_BASE_URL || 'https://bondmath.chrislyons.dev';
}

/**
 * Calculate day count year fractions via Gateway API.
 *
 * @endpoint POST /api/daycount/v1/count
 * @authentication auth0-oidc
 * @scope daycount:write
 *
 * Sends day count calculation request to Gateway, which forwards to
 * the Day-Count service after Auth0 token verification and internal
 * JWT minting.
 *
 * @param request - Calculation request with date pairs and convention
 * @param token - Optional Auth0 access token (required if Gateway enforces auth)
 * @returns Calculation results with year fractions
 * @throws {ApiError} If request fails validation or server error occurs
 *
 * @example
 * ```typescript
 * const token = await getAccessTokenSilently();
 * const response = await calculateDayCount({
 *   pairs: [{ start: '2024-01-01', end: '2024-07-01' }],
 *   convention: 'ACT_360'
 * }, token);
 *
 * console.log(response.results[0].yearFraction); // 0.50277...
 * ```
 */
export async function calculateDayCount(
  request: DayCountRequest,
  token?: string
): Promise<DayCountResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add Authorization header if token is provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}/api/daycount/count`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new ApiError(error.detail, error.status, error.errors);
  }

  return response.json();
}
