/**
 * Gateway Worker - Entry point and security gate for Bond Math API
 *
 * Handles Auth0 OIDC verification, internal JWT minting with actor claims,
 * and routing to downstream services via Cloudflare service bindings.
 *
 * @service gateway
 * @type cloudflare-worker-typescript
 * @layer gateway
 * @description Entry point for all API traffic - handles Auth0 verification, internal JWT minting, and service routing
 * @owner platform-team
 * @internal-routes /health, /api/*
 * @dependencies svc-daycount, svc-valuation, svc-metrics, svc-pricing
 * @security-model auth0-oidc
 * @sla-tier critical
 *
 * Zero-trust architecture: All requests authenticated via Auth0, internal services
 * receive short-lived JWT tokens (90s TTL) with actor claims for accountability.
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
import { logger as pinoLogger } from './logger';

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

      // Log blocked CORS request
      pinoLogger.warn({ origin }, 'Blocked CORS request');
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
 * Returns gateway service health status and version information.
 *
 * @endpoint GET /health
 * @gateway-route GET /health
 * @authentication none
 * @scope none
 *
 * @returns {Object} Health status with service name and version
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
 *
 * Verifies Auth0 OIDC tokens, mints internal JWT with actor claims,
 * and routes requests to downstream services via service bindings.
 * Scope enforcement is delegated to individual services.
 *
 * @endpoint ALL /api/*
 * @gateway-route ALL /api/*
 * @authentication auth0-oidc
 * @scope (varies by downstream service)
 *
 * @param {Request} request - Incoming HTTP request with Authorization header
 * @returns {Response} Response from downstream service or error response
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
