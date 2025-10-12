/**
 * Service routing module
 * Follows Single Responsibility Principle - handles only request routing to service bindings
 *
 * @module router
 */

import type { Env, ServiceRoute } from './types';

/**
 * Service route configuration
 * Maps URL prefixes to service bindings
 */
const SERVICE_ROUTES: ServiceRoute[] = [
  {
    prefix: '/api/daycount',
    binding: 'SVC_DAYCOUNT',
    stripPrefix: true,
  },
  {
    prefix: '/api/valuation',
    binding: 'SVC_VALUATION',
    stripPrefix: true,
  },
  {
    prefix: '/api/metrics',
    binding: 'SVC_METRICS',
    stripPrefix: true,
  },
  {
    prefix: '/api/pricing',
    binding: 'SVC_PRICING',
    stripPrefix: true,
  },
];

/**
 * Finds the appropriate service binding for a given URL path
 *
 * @param path - Request URL path
 * @returns Service route configuration or null if no match
 */
export function findServiceRoute(path: string): ServiceRoute | null {
  for (const route of SERVICE_ROUTES) {
    if (path.startsWith(route.prefix)) {
      return route;
    }
  }
  return null;
}

/**
 * Routes a request to the appropriate service binding
 *
 * @param request - Original request
 * @param route - Service route configuration
 * @param env - Cloudflare environment bindings
 * @param internalToken - Internal JWT token for authorization
 * @returns Response from the service
 */
export async function routeToService(
  request: Request,
  route: ServiceRoute,
  env: Env,
  internalToken: string
): Promise<Response> {
  const service = env[route.binding] as Fetcher;

  if (!service) {
    throw new Error(`Service binding ${route.binding} not configured`);
  }

  // Build the forwarded request
  const forwardedRequest = createForwardedRequest(request, route, internalToken);

  // Call the service via service binding
  return await service.fetch(forwardedRequest);
}

/**
 * Creates a forwarded request with internal authorization
 *
 * @param originalRequest - Original incoming request
 * @param route - Service route configuration
 * @param internalToken - Internal JWT token
 * @returns New Request object for the service
 */
function createForwardedRequest(
  originalRequest: Request,
  route: ServiceRoute,
  internalToken: string
): Request {
  const url = new URL(originalRequest.url);

  // Strip prefix if configured
  if (route.stripPrefix) {
    url.pathname = url.pathname.substring(route.prefix.length) || '/';
  }

  // Clone headers and replace authorization
  const headers = new Headers(originalRequest.headers);
  headers.set('Authorization', `Bearer ${internalToken}`);
  headers.set('X-Forwarded-By', 'gateway');
  headers.set('X-Original-Path', originalRequest.url);

  // Create new request
  return new Request(url.toString(), {
    method: originalRequest.method,
    headers,
    body: originalRequest.body,
    // @ts-expect-error - duplex is required for streaming bodies
    duplex: 'half',
  });
}

/**
 * Determines the target service identifier from the route
 *
 * @param route - Service route configuration
 * @returns Service identifier (e.g., "svc-pricing")
 */
export function getServiceIdentifier(route: ServiceRoute): string {
  const bindingName = route.binding.toLowerCase();
  return bindingName.replace('_', '-');
}
