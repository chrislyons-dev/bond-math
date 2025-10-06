/**
 * Error handling module
 * Follows RFC 7807 Problem Details standard
 *
 * @module errors
 */

import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { ErrorResponse, Env, Variables } from './types';

/**
 * Creates an RFC 7807 Problem Details error response
 *
 * @param status - HTTP status code
 * @param title - Short error title
 * @param detail - Detailed error message
 * @param instance - Optional request path
 * @returns JSON Response with error details
 */
export function createErrorResponse(
  status: number,
  title: string,
  detail: string,
  instance?: string
): Response {
  const errorBody: ErrorResponse = {
    type: `https://bondmath.chrislyons.dev/errors/${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    status,
    detail,
    instance,
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
    },
  });
}

/**
 * Creates a 401 Unauthorized response
 *
 * @param detail - Error detail message
 * @param instance - Optional request path
 * @returns 401 Response
 */
export function createUnauthorizedResponse(detail: string, instance?: string): Response {
  return createErrorResponse(401, 'Unauthorized', detail, instance);
}

/**
 * Creates a 403 Forbidden response
 *
 * @param detail - Error detail message
 * @param instance - Optional request path
 * @returns 403 Response
 */
export function createForbiddenResponse(detail: string, instance?: string): Response {
  return createErrorResponse(403, 'Forbidden', detail, instance);
}

/**
 * Creates a 404 Not Found response
 *
 * @param detail - Error detail message
 * @param instance - Optional request path
 * @returns 404 Response
 */
export function createNotFoundResponse(detail: string, instance?: string): Response {
  return createErrorResponse(404, 'Not Found', detail, instance);
}

/**
 * Creates a 500 Internal Server Error response
 *
 * @param detail - Error detail message
 * @param instance - Optional request path
 * @returns 500 Response
 */
export function createInternalErrorResponse(detail: string, instance?: string): Response {
  return createErrorResponse(500, 'Internal Server Error', detail, instance);
}

/**
 * Handles errors and returns appropriate Response
 * Follows Open/Closed Principle - extensible for new error types
 *
 * @param error - Error object
 * @param instance - Optional request path
 * @returns Error Response
 */
export function handleError(error: unknown, instance?: string): Response {
  // Handle Hono HTTPException
  if (error instanceof HTTPException) {
    return createErrorResponse(error.status, error.message, error.message, instance);
  }

  if (error instanceof Error) {
    return mapErrorToResponse(error, instance);
  }

  return createInternalErrorResponse('An unexpected error occurred', instance);
}

/**
 * Global error handler for Hono app
 * Converts all errors to RFC 7807 Problem Details format
 *
 * @param err - Error object
 * @param c - Hono context
 * @returns Error Response
 */
export function globalErrorHandler(
  err: Error,
  c: Context<{ Bindings: Env; Variables: Variables }>
): Response {
  const requestId = c.get('requestId');
  const path = c.req.path;

  // Log error with request ID
  console.error(`[${requestId}] Error: ${err.message}`, err);

  // Handle different error types
  if (err instanceof HTTPException) {
    const errorBody: ErrorResponse = {
      type: `https://bondmath.chrislyons.dev/errors/${err.status}`,
      title: err.message,
      status: err.status,
      detail: err.message,
      instance: path,
    };

    return c.json(errorBody, err.status, {
      'Content-Type': 'application/problem+json',
    });
  }

  // Map standard errors
  return handleError(err, path);
}

/**
 * Error pattern mappings for reduced complexity
 * Maps error patterns to response factory functions
 */
const ERROR_MAPPINGS: Array<{
  pattern: RegExp;
  handler: (instance?: string) => Response;
}> = [
  // Authentication errors (401)
  {
    pattern: /token.*expired/i,
    handler: (inst) => createUnauthorizedResponse('Authentication token expired', inst),
  },
  {
    pattern: /token.*invalid/i,
    handler: (inst) => createUnauthorizedResponse('Invalid authentication token', inst),
  },
  {
    pattern: /missing.*token/i,
    handler: (inst) => createUnauthorizedResponse('Missing authentication token', inst),
  },
  // Authorization errors (403)
  {
    pattern: /audience/i,
    handler: (inst) => createForbiddenResponse('Invalid token audience', inst),
  },
  {
    pattern: /issuer/i,
    handler: (inst) => createForbiddenResponse('Invalid token issuer', inst),
  },
  // Service errors (500)
  {
    pattern: /service.*not configured/i,
    handler: (inst) => createInternalErrorResponse('Service temporarily unavailable', inst),
  },
];

/**
 * Maps specific error messages to appropriate HTTP responses
 * Uses pattern matching to reduce cyclomatic complexity
 *
 * @param error - Error object
 * @param instance - Optional request path
 * @returns Error Response
 */
function mapErrorToResponse(error: Error, instance?: string): Response {
  const message = error.message;

  // Find first matching pattern
  for (const mapping of ERROR_MAPPINGS) {
    if (mapping.pattern.test(message)) {
      return mapping.handler(instance);
    }
  }

  // Default to internal error for unknown errors
  return createInternalErrorResponse(error.message, instance);
}
