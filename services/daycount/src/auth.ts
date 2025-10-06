/**
 * Internal JWT authentication module for Day Count Worker
 * Verifies JWTs minted by the Gateway Worker
 *
 * SECURITY: This module is critical to zero-trust authorization.
 * All modifications require security review.
 *
 * @module auth
 */

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

/**
 * Internal JWT payload structure (from Gateway)
 */
export interface InternalJWT {
  iss: string; // "https://gateway.bond-math"
  sub: string; // Service identifier (e.g., "svc-gateway")
  aud: string; // Target service (e.g., "svc-daycount")
  exp: number; // Expiration timestamp
  rid: string; // Request ID for tracing
  act: ActorClaim; // Actor (user) information
}

/**
 * Actor claim - represents "Service X acting for User Y"
 */
export interface ActorClaim {
  iss: string; // Original issuer (Auth0 domain)
  sub: string; // User ID from Auth0
  role?: string; // User role (free, professional, admin, service)
  perms: string[]; // User permissions/scopes
  org?: string; // Organization ID
  uid?: string; // Internal user ID
}

/**
 * Environment configuration
 */
export interface Env {
  INTERNAL_JWT_SECRET: string;
  ENVIRONMENT?: string;
}

/**
 * Middleware to verify internal JWT tokens from Gateway
 *
 * @authentication internal-jwt
 * @description Verifies HMAC-signed JWT from Gateway, validates audience and expiration
 */
export function verifyInternalJWT(expectedAudience: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Extract Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      throw new HTTPException(401, {
        message: 'Missing Authorization header',
      });
    }

    // Extract Bearer token
    const match = authHeader.match(/^Bearer\s+(\S+)$/i);
    if (!match || !match[1]) {
      throw new HTTPException(401, {
        message: 'Invalid Authorization header format',
      });
    }

    const token = match[1];
    const secret = c.env.INTERNAL_JWT_SECRET;

    if (!secret) {
      console.error('INTERNAL_JWT_SECRET not configured');
      throw new HTTPException(500, {
        message: 'Service configuration error',
      });
    }

    // Validate secret strength
    if (secret.length < 32) {
      console.error('INTERNAL_JWT_SECRET is too short (minimum 32 characters)');
      throw new HTTPException(500, {
        message: 'Service configuration error',
      });
    }

    // Warn about weak secrets in production
    if (c.env.ENVIRONMENT === 'production' && /^(test|dev|secret|password)/i.test(secret)) {
      console.warn('INTERNAL_JWT_SECRET appears to be a weak or default value');
    }

    // Verify and decode token
    try {
      const payload = await verifyToken(token, secret, expectedAudience);

      // Store actor claim in context for handlers
      c.set('actor', payload.act);
      c.set('requestId', payload.rid);

      await next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token verification failed';
      console.error(`JWT verification failed: ${message}`);

      if (message.includes('expired')) {
        throw new HTTPException(401, { message: 'Token expired' });
      } else if (message.includes('audience')) {
        throw new HTTPException(403, { message: 'Invalid token audience' });
      } else {
        throw new HTTPException(401, { message: 'Invalid token' });
      }
    }
  };
}

/**
 * Verifies an internal JWT token
 *
 * SECURITY: Validates signature, expiration, and audience
 *
 * @param token - JWT token to verify
 * @param secret - HMAC signing secret
 * @param expectedAudience - Expected audience (service identifier)
 * @returns Decoded payload if valid
 * @throws Error if verification fails
 */
async function verifyToken(
  token: string,
  secret: string,
  expectedAudience: string
): Promise<InternalJWT> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify signature
  const data = `${headerB64}.${payloadB64}`;
  const signature = base64UrlDecodeToArrayBuffer(signatureB64!);
  const isValid = await verifySignature(data, signature, secret);

  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  // Decode and validate payload
  const payload = JSON.parse(base64UrlDecodeToString(payloadB64!)) as InternalJWT;
  validateClaims(payload, expectedAudience);

  return payload;
}

/**
 * Verifies HMAC signature
 *
 * @param data - Signed data
 * @param signature - Signature to verify
 * @param secret - HMAC secret
 * @returns True if signature is valid
 */
async function verifySignature(
  data: string,
  signature: ArrayBuffer,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  return await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
}

/**
 * Validates internal JWT claims
 *
 * SECURITY: Checks audience, expiration, and actor claim
 *
 * @param payload - JWT payload
 * @param expectedAudience - Expected audience
 * @throws Error if validation fails
 */
function validateClaims(payload: InternalJWT, expectedAudience: string): void {
  // Validate audience
  if (payload.aud !== expectedAudience) {
    throw new Error(`Invalid token audience: expected ${expectedAudience}, got ${payload.aud}`);
  }

  // Validate expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  // Validate actor claim exists
  if (!payload.act || !payload.act.sub) {
    throw new Error('Missing actor claim');
  }

  // Validate issuer (optional but recommended)
  if (payload.iss !== 'https://gateway.bond-math') {
    console.warn(`Unexpected token issuer: ${payload.iss}`);
  }
}

/**
 * Base64url decodes to string
 *
 * @param str - Base64url encoded string
 * @returns Decoded string
 */
function base64UrlDecodeToString(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

/**
 * Base64url decodes to ArrayBuffer
 *
 * @param str - Base64url encoded string
 * @returns Decoded ArrayBuffer
 */
function base64UrlDecodeToArrayBuffer(str: string): ArrayBuffer {
  const decoded = base64UrlDecodeToString(str);
  const bytes = new Uint8Array(decoded.length);

  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }

  return bytes.buffer;
}
