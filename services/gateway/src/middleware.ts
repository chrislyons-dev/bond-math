/**
 * Middleware module for Gateway Worker
 * Provides logging, rate limiting, and request ID tracking
 *
 * @module middleware
 */

import type { Context, Next } from 'hono';
import type { Env, Variables } from './types';

/**
 * Logger middleware - logs request/response with timing
 *
 * @endpoint-middleware ALL *
 * @description Logs incoming requests and responses with timing information
 */
export async function logger(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get('requestId');

  console.log(`[${requestId}] --> ${method} ${path}`);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  console.log(`[${requestId}] <-- ${method} ${path} ${status} (${duration}ms)`);
}

/**
 * Request ID middleware - generates and attaches unique request ID
 *
 * @endpoint-middleware ALL *
 * @description Generates UUID for request tracing, adds to headers
 */
export async function requestId(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
): Promise<void> {
  // Check if request already has an ID (from upstream)
  let rid = c.req.header('X-Request-ID');

  // Generate new ID if not present
  if (!rid) {
    rid = crypto.randomUUID();
  }

  // Store in context for use by other middleware and handlers
  c.set('requestId', rid);

  // Add to response headers for client tracing
  c.header('X-Request-ID', rid);

  await next();
}

/**
 * Rate limiting middleware - simple in-memory rate limiter
 *
 * @endpoint-middleware ALL /api/*
 * @description Rate limits requests per user/IP to prevent abuse
 *
 * Note: This is a simple in-memory implementation suitable for single-worker
 * deployments. For production, consider Cloudflare Rate Limiting API or
 * Durable Objects for distributed rate limiting.
 */
export function rateLimiter(options: {
  windowMs: number;
  maxRequests: number;
}): (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => Promise<Response | void> {
  // Simple in-memory store (resets on worker restart)
  const requests = new Map<string, { count: number; resetTime: number }>();

  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ): Promise<Response | void> => {
    // Use user ID from context if available (set by auth middleware)
    const userId = c.get('userId');
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const key = userId || ip;

    const now = Date.now();
    const record = requests.get(key);

    // Reset window if expired
    if (!record || now > record.resetTime) {
      requests.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });

      // Add rate limit headers for first request
      c.header('X-RateLimit-Limit', options.maxRequests.toString());
      c.header('X-RateLimit-Remaining', (options.maxRequests - 1).toString());
      c.header('X-RateLimit-Reset', Math.ceil(options.windowMs / 1000).toString());

      return next();
    }

    // Check if limit exceeded
    if (record.count >= options.maxRequests) {
      const resetIn = Math.ceil((record.resetTime - now) / 1000);

      return c.json(
        {
          type: 'https://bondmath.chrislyons.dev/errors/rate-limit-exceeded',
          title: 'Too Many Requests',
          status: 429,
          detail: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
          instance: c.req.path,
        },
        429,
        {
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetIn.toString(),
        }
      );
    }

    // Increment counter
    record.count++;

    // Add rate limit headers
    c.header('X-RateLimit-Limit', options.maxRequests.toString());
    c.header('X-RateLimit-Remaining', (options.maxRequests - record.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil((record.resetTime - now) / 1000).toString());

    return next();
  };
}

/**
 * Security headers middleware
 *
 * @endpoint-middleware ALL *
 * @description Adds comprehensive security-related HTTP headers
 */
export async function securityHeaders(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
): Promise<void> {
  // Prevent MIME sniffing
  c.header('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');

  // XSS protection (legacy, but doesn't hurt)
  c.header('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (strict for API)
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );

  // HSTS (only in production) - enforce HTTPS
  const env = c.env?.ENVIRONMENT;
  if (env === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Permissions Policy (restrict all browser features)
  c.header(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  // Prevent Flash/PDF cross-domain policies
  c.header('X-Permitted-Cross-Domain-Policies', 'none');

  await next();
}

/**
 * Performance timing middleware
 *
 * @endpoint-middleware ALL *
 * @description Adds Server-Timing header for performance monitoring
 */
export async function timing(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
): Promise<void> {
  const start = Date.now();
  await next();
  const total = Date.now() - start;

  // Add total timing
  c.header('Server-Timing', `total;dur=${total}`);
}
