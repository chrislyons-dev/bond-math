/**
 * API Client for Bond Math services
 */

export interface DatePair {
  start: string;
  end: string;
}

export type DayCountConvention =
  | '30_360'
  | '30E_360'
  | 'ACT_360'
  | 'ACT_365F'
  | 'ACT_ACT_ISDA'
  | 'ACT_ACT_ICMA';

export interface DayCountOptions {
  eomRule?: boolean;
  frequency?: number;
}

export interface DayCountRequest {
  pairs: DatePair[];
  convention: DayCountConvention;
  options?: DayCountOptions;
}

export interface DayCountResult {
  days: number;
  yearFraction: number;
  basis: number;
}

export interface DayCountResponse {
  results: DayCountResult[];
  convention: DayCountConvention;
  version: string;
}

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
 * Get API base URL - uses same origin in browser, falls back to env var or production URL
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
 * Calculate day count year fractions
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

  const response = await fetch(`${getApiBaseUrl()}/api/daycount/v1/count`, {
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
