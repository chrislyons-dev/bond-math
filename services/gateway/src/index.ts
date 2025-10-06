/**
 * Gateway Worker - Entry point and security gate for Bond Math API
 *
 * @service gateway
 * @type cloudflare-worker
 * @layer api-gateway
 * @description Entry point for all API traffic - handles Auth0 verification, internal JWT minting, and service routing
 * @owner platform-team
 * @public-routes /api/*
 * @internal-routes none
 * @dependencies SVC_DAYCOUNT, SVC_VALUATION, SVC_METRICS, SVC_PRICING
 * @security-model auth0-oidc
 * @sla-tier critical
 * @calls daycount, valuation, metrics, pricing
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from './types';
import { verifyAuth0Token, extractBearerToken } from './auth0';
import { mintInternalToken } from './jwt';
import { findServiceRoute, routeToService, getServiceIdentifier } from './router';
import {
  createUnauthorizedResponse,
  createNotFoundResponse,
  handleError,
  globalErrorHandler,
} from './errors';
import { logger, requestId, rateLimiter, securityHeaders, timing } from './middleware';

const VERSION = '2025.10';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global error handler
app.onError(globalErrorHandler);

// Global middleware chain (order matters!)
// 1. Request ID - must be first for logging
app.use('*', requestId);

// 2. Security headers
app.use('*', securityHeaders);

// 3. Performance timing
app.use('*', timing);

// 4. Logging - after request ID is set
app.use('*', logger);

// 5. CORS - restrict to single domain (bondmath.chrislyons.dev)
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow requests with no origin (same-origin, curl, Postman, server-to-server)
      if (!origin) return origin;

      // Production: Allow only bondmath.chrislyons.dev
      const allowedOrigins = [
        'https://bondmath.chrislyons.dev',
        'https://www.bondmath.chrislyons.dev',
      ];

      // Development/Testing: Allow localhost
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return origin;
      }

      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      console.warn(`Blocked CORS request from origin: ${origin}`);
      return null;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400,
  })
);

// 6. Rate limiting - only for API routes
app.use(
  '/api/*',
  rateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })
);

/**
 * Health check endpoint
 *
 * @endpoint GET /health
 * @authentication none
 * @description Returns gateway health status
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'gateway',
    version: VERSION,
  });
});

/**
 * Main API routing handler
 * Follows Single Responsibility - delegates to focused modules
 *
 * @endpoint ALL /api/*
 * @gateway-route ALL /api/*
 * @authentication auth0-oidc
 * @description Verifies Auth0 token, mints internal JWT, routes to service bindings
 */
app.all('/api/*', async (c) => {
  const request = c.req.raw;
  const path = new URL(request.url).pathname;

  try {
    // Step 1: Extract and verify Auth0 token
    const auth0Token = extractBearerToken(request.headers.get('Authorization'));
    if (!auth0Token) {
      return createUnauthorizedResponse('Missing authentication token', path);
    }

    const auth0Claims = await verifyAuth0Token(
      auth0Token,
      c.env.AUTH0_DOMAIN,
      c.env.AUTH0_AUDIENCE
    );

    // Store user ID in context for rate limiting and logging
    c.set('userId', auth0Claims.sub);

    // Step 2: Find service route
    const route = findServiceRoute(path);
    if (!route) {
      return createNotFoundResponse('Service not found', path);
    }

    // Step 3: Mint internal JWT for target service
    const targetService = getServiceIdentifier(route);
    const ttl = parseInt(c.env.INTERNAL_JWT_TTL || '90', 10);
    const internalToken = await mintInternalToken(
      auth0Claims,
      targetService,
      c.env.INTERNAL_JWT_SECRET,
      ttl
    );

    // Step 4: Route to service via service binding
    const response = await routeToService(request, route, c.env, internalToken);

    return response;
  } catch (error) {
    return handleError(error, path);
  }
});

/**
 * Fallback handler for unknown routes
 */
app.all('*', (c) => {
  const path = new URL(c.req.url).pathname;
  return createNotFoundResponse('Route not found', path);
});

export default app;
