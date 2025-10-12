/**
 * Scope validation middleware for Day Count service
 * Enforces OAuth 2.0 scope-based authorization
 *
 * @module scopes
 */

import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ActorClaim } from './types';

/**
 * Middleware to require specific scopes for an endpoint
 * Validates that the actor has ALL required scopes
 *
 * @param requiredScopes - Array of required scope strings
 * @returns Hono middleware function
 * @throws HTTPException 403 if scopes are missing
 *
 * @example
 * ```typescript
 * app.post('/count', requireScopes('daycount:write'), async (c) => {
 *   // Handler logic
 * });
 * ```
 */
export function requireScopes(...requiredScopes: string[]) {
  return async (c: Context, next: Next) => {
    const actor = c.get('actor') as ActorClaim | undefined;

    // If no actor is set, authentication failed upstream
    if (!actor) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }

    const userPerms = actor.perms || [];

    // Check if user has all required scopes
    const missingScopes = requiredScopes.filter((scope) => !userPerms.includes(scope));

    if (missingScopes.length > 0) {
      throw new HTTPException(403, {
        message: `Insufficient permissions. Missing scopes: ${missingScopes.join(', ')}`,
      });
    }

    await next();
  };
}

/**
 * Middleware to require ANY of the specified scopes (OR logic)
 * Validates that the actor has AT LEAST ONE of the required scopes
 *
 * @param allowedScopes - Array of allowed scope strings
 * @returns Hono middleware function
 * @throws HTTPException 403 if none of the scopes match
 *
 * @example
 * ```typescript
 * // Allow either read or write access
 * app.get('/conventions', requireAnyScope('daycount:read', 'daycount:write'), async (c) => {
 *   // Handler logic
 * });
 * ```
 */
export function requireAnyScope(...allowedScopes: string[]) {
  return async (c: Context, next: Next) => {
    const actor = c.get('actor') as ActorClaim | undefined;

    if (!actor) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }

    const userPerms = actor.perms || [];

    // Check if user has at least one of the allowed scopes
    const hasAnyScope = allowedScopes.some((scope) => userPerms.includes(scope));

    if (!hasAnyScope) {
      throw new HTTPException(403, {
        message: `Insufficient permissions. Requires one of: ${allowedScopes.join(', ')}`,
      });
    }

    await next();
  };
}

/**
 * Middleware to require a specific role
 * Validates that the actor has the required role
 *
 * @param allowedRoles - Array of allowed role strings
 * @returns Hono middleware function
 * @throws HTTPException 403 if role doesn't match
 *
 * @example
 * ```typescript
 * app.get('/admin', requireRole('admin'), async (c) => {
 *   // Admin-only handler
 * });
 * ```
 */
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const actor = c.get('actor') as ActorClaim | undefined;

    if (!actor) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }

    const userRole = actor.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new HTTPException(403, {
        message: `Insufficient permissions. Requires role: ${allowedRoles.join(' or ')}`,
      });
    }

    await next();
  };
}
