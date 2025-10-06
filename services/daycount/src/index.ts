/**
 * Day-Count Worker - Authoritative day-count and year-fraction calculations
 *
 * @service daycount
 * @type cloudflare-worker
 * @layer business-logic
 * @description Authoritative day-count and year-fraction calculations for fixed income
 * @owner platform-team
 * @public-routes /count, /health
 * @internal-routes /count
 * @dependencies none
 * @security-model internal-jwt
 * @sla-tier high
 * @note API versioning (v1) is handled at Gateway level
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import type {
  DayCountRequest,
  DayCountResponse,
  ErrorResponse,
  DayCountConvention,
  DayCountResult,
  DayCountOptions,
} from './types';
import {
  calculateACT360,
  calculateACT365F,
  calculate30360,
  calculate30E360,
  calculateACTACTISDA,
  calculateACTACTICMA,
} from './conventions';
import { parseDate, validateDateOrder } from './utils';
import {
  validateRequest,
  validatePairStructure,
  normalizeConvention,
  type ValidationError,
} from './validators';
import { verifyInternalJWT, type Env } from './auth';
import { requireScopes } from './scopes';

const VERSION = '2025.10';

const app = new Hono<{ Bindings: Env }>();

// Global error handler - converts HTTPException to JSON
app.onError((err, c) => {
  // Check if it's an HTTPException (Hono's error type)
  if ('status' in err && typeof err.status === 'number') {
    const httpErr = err as { status: number; message: string };
    return c.json(
      {
        type: 'https://bondmath.chrislyons.dev/errors/authorization-error',
        title: httpErr.status === 401 ? 'Unauthorized' : 'Forbidden',
        status: httpErr.status,
        detail: httpErr.message || 'Authorization failed',
        message: httpErr.message || 'Authorization failed',
      },
      httpErr.status as 401 | 403 | 500
    );
  }

  // Fallback for other errors
  console.error('Unhandled error:', err);
  return c.json(
    {
      type: 'https://bondmath.chrislyons.dev/errors/internal-error',
      title: 'Internal Server Error',
      status: 500,
      detail: err instanceof Error ? err.message : 'An unexpected error occurred',
      message: err instanceof Error ? err.message : 'An unexpected error occurred',
    },
    500
  );
});

// CORS middleware (for direct access during development)
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Request body size limit - prevent DoS attacks
app.use('/count', bodyLimit({
  maxSize: 100 * 1024, // 100KB
  onError: (c) => {
    return c.json(
      createErrorBody(
        413,
        'Payload Too Large',
        'Request body must not exceed 100KB'
      ),
      413
    );
  }
}));

// Authentication middleware - verify internal JWT from Gateway
// Applied to /count endpoint only (health check is public)
app.use('/count', verifyInternalJWT('svc-daycount'));

// Authorization middleware - require daycount:write scope
app.use('/count', requireScopes('daycount:write'));

/**
 * Creates an RFC 7807 Problem Details error response.
 *
 * @param status - HTTP status code
 * @param title - Short error title
 * @param detail - Detailed error message
 * @param errors - Optional field-level errors
 * @returns Error response object
 */
function createErrorBody(
  status: number,
  title: string,
  detail: string,
  errors?: ValidationError[]
): ErrorResponse {
  return {
    type: `https://bondmath.chrislyons.dev/errors/${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    status,
    detail,
    errors,
  };
}

/**
 * Calculates year fraction for a single date pair using the specified convention.
 *
 * @param startStr - Start date (ISO 8601)
 * @param endStr - End date (ISO 8601)
 * @param convention - Day-count convention
 * @param options - Calculation options
 * @returns Day-count result
 */
function calculateSingle(
  startStr: string,
  endStr: string,
  convention: DayCountConvention,
  options: DayCountOptions = {}
): DayCountResult {
  const start = parseDate(startStr);
  const end = parseDate(endStr);

  validateDateOrder(start, end);

  switch (convention) {
    case 'ACT_360':
      return calculateACT360(start, end);

    case 'ACT_365F':
      return calculateACT365F(start, end);

    case '30_360':
      return calculate30360(start, end, options);

    case '30E_360':
      return calculate30E360(start, end);

    case 'ACT_ACT_ISDA':
      return calculateACTACTISDA(start, end);

    case 'ACT_ACT_ICMA':
      return calculateACTACTICMA(start, end, options);
  }

  // TypeScript exhaustiveness check
  const _exhaustive: never = convention;
  throw new Error(`Convention not implemented: ${String(_exhaustive)}`);
}

/**
 * Handles POST /count endpoint.
 *
 * @endpoint POST /count
 * @gateway-route POST /api/daycount/v1/count
 * @authentication internal-jwt
 * @scope daycount:write
 * @rate-limit 100/min
 * @cacheable true
 * @cache-ttl 3600
 * @description Calculates year fractions and accrual days for multiple date pairs
 */
app.post('/count', async (c) => {
  // Parse JSON body
  let body: DayCountRequest;
  try {
    const json: unknown = await c.req.json();
    body = json as DayCountRequest;
  } catch {
    return c.json(
      createErrorBody(400, 'Invalid JSON', 'Request body must be valid JSON'),
      400
    );
  }

  // Run request-level validators
  const validationError = validateRequest(body);
  if (validationError) {
    return c.json(
      createErrorBody(400, 'Validation Error', validationError.message, [validationError]),
      400
    );
  }

  // Normalize convention
  let convention: DayCountConvention;
  try {
    convention = normalizeConvention(body.convention);
  } catch (err) {
    return c.json(
      createErrorBody(400, 'Invalid Convention', (err as Error).message, [
        { field: 'convention', message: (err as Error).message },
      ]),
      400
    );
  }

  // Calculate results for all pairs
  const results: DayCountResult[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < body.pairs.length; i++) {
    const pair = body.pairs[i];
    if (!pair) continue;

    // Validate pair structure
    const pairError = validatePairStructure(pair, i);
    if (pairError) {
      errors.push(pairError);
      continue;
    }

    // Calculate day count
    try {
      const result = calculateSingle(pair.start, pair.end, convention, body.options);
      results.push(result);
    } catch (err) {
      errors.push({
        field: `pairs[${i}]`,
        message: (err as Error).message,
      });
    }
  }

  // Return errors if any calculations failed
  if (errors.length > 0) {
    return c.json(
      createErrorBody(
        400,
        'Calculation Error',
        'One or more date pairs could not be calculated',
        errors
      ),
      400
    );
  }

  // Build successful response
  const response: DayCountResponse = {
    results,
    convention,
    version: VERSION,
  };

  return c.json(response, 200, {
    'Cache-Control': 'public, max-age=3600',
    'X-Service-Version': VERSION,
  });
});

/**
 * Health check endpoint.
 *
 * @endpoint GET /health
 * @authentication none
 * @description Returns service health status
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'daycount',
    version: VERSION,
  });
});

export default app;
