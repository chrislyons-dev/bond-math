/**
 * Internal JWT minting and verification module
 * Follows Single Responsibility Principle - handles only internal JWT operations
 *
 * @module jwt
 */

import type { InternalJWT, ActorClaim, Auth0Claims } from './types';

const VERSION = '2025.10';

/**
 * Mints a short-lived internal JWT for service-to-service communication
 *
 * @param auth0Claims - Verified Auth0 token claims
 * @param targetService - Target service identifier (e.g., "svc-pricing")
 * @param secret - HMAC signing secret
 * @param ttl - Time to live in seconds (default 90)
 * @returns Signed JWT token
 */
export async function mintInternalToken(
  auth0Claims: Auth0Claims,
  targetService: string,
  secret: string,
  ttl: number = 90
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const requestId = generateRequestId();

  const payload: InternalJWT = {
    iss: 'https://gateway.bond-math',
    sub: 'svc-gateway',
    aud: targetService,
    exp: now + ttl,
    rid: requestId,
    act: createActorClaim(auth0Claims),
  };

  return await signJWT(payload, secret);
}

/**
 * Creates an actor claim from Auth0 claims
 * Represents "Service X acting for User Y"
 *
 * @param auth0Claims - Verified Auth0 claims
 * @returns Actor claim object
 */
function createActorClaim(auth0Claims: Auth0Claims): ActorClaim {
  const permissions = extractPermissions(auth0Claims);
  const role = auth0Claims['https://bondmath.chrislyons.dev/role'];
  const userId = auth0Claims['https://bondmath.chrislyons.dev/user_id'];
  const orgId = auth0Claims['https://bondmath.chrislyons.dev/org_id'];

  return {
    iss: auth0Claims.iss,
    sub: auth0Claims.sub,
    role: role,
    perms: permissions,
    org: orgId,
    uid: userId,
  };
}

/**
 * Extracts permissions from Auth0 claims
 * Prioritizes custom namespaced claims, falls back to standard claims
 *
 * @param claims - Auth0 claims
 * @returns Array of permission strings
 */
function extractPermissions(claims: Auth0Claims): string[] {
  // Prioritize custom namespaced permissions from Auth0 Action
  const customPerms = claims['https://bondmath.chrislyons.dev/permissions'];
  if (customPerms && Array.isArray(customPerms)) {
    return customPerms;
  }

  // Fall back to standard permissions array
  if (claims.permissions && Array.isArray(claims.permissions)) {
    return claims.permissions;
  }

  // Fall back to scope string (space-separated)
  if (claims.scope) {
    return claims.scope.split(' ').filter((s) => s.length > 0);
  }

  return [];
}

/**
 * Signs a JWT payload using HMAC-SHA256
 *
 * @param payload - JWT payload object
 * @param secret - HMAC signing secret
 * @returns Signed JWT token (base64url encoded)
 */
async function signJWT(payload: InternalJWT, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    ver: VERSION,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const signature = await signData(data, secret);
  const signatureB64 = base64UrlEncode(signature);

  return `${data}.${signatureB64}`;
}

/**
 * Signs data using HMAC-SHA256
 *
 * @param data - Data to sign
 * @param secret - HMAC secret key
 * @returns Signature as ArrayBuffer
 */
async function signData(data: string, secret: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  return await crypto.subtle.sign('HMAC', key, encoder.encode(data));
}

/**
 * Validates secret strength
 *
 * @param secret - Secret to validate
 * @param secretName - Name of secret for error message
 * @throws Error if secret is too short
 */
function validateSecretStrength(secret: string, secretName: string): void {
  if (secret.length < 32) {
    throw new Error(`${secretName} must be at least 32 characters`);
  }
}

/**
 * Parses JWT token into parts
 *
 * @param token - JWT token to parse
 * @returns Tuple of [headerB64, payloadB64, signatureB64]
 * @throws Error if token format is invalid
 */
function parseTokenParts(token: string): [string, string, string] {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const headerB64 = parts[0];
  const payloadB64 = parts[1];
  const signatureB64 = parts[2];

  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error('Invalid token format');
  }

  return [headerB64, payloadB64, signatureB64];
}

/**
 * Verifies an internal JWT token with dual-secret support
 *
 * @param token - JWT token to verify
 * @param secret - Current HMAC signing secret
 * @param expectedAudience - Expected audience (service identifier)
 * @param previousSecret - Previous HMAC secret for rotation grace period (optional)
 * @returns Decoded payload if valid
 * @throws Error if verification fails
 */
export async function verifyInternalToken(
  token: string,
  secret: string,
  expectedAudience: string,
  previousSecret?: string
): Promise<InternalJWT> {
  // Validate secret strength
  validateSecretStrength(secret, 'INTERNAL_JWT_SECRET');
  if (previousSecret) {
    validateSecretStrength(previousSecret, 'Previous INTERNAL_JWT_SECRET');
  }

  // Parse token
  const [headerB64, payloadB64, signatureB64] = parseTokenParts(token);

  // Verify signature with dual-secret support
  const data = `${headerB64}.${payloadB64}`;
  const signature = base64UrlDecodeToArrayBuffer(signatureB64);
  let isValid = await verifySignature(data, signature, secret);

  if (!isValid && previousSecret) {
    isValid = await verifySignature(data, signature, previousSecret);
  }

  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  // Decode and validate payload
  const payload = JSON.parse(base64UrlDecodeToString(payloadB64)) as InternalJWT;
  validateInternalClaims(payload, expectedAudience);

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
 * @param payload - JWT payload
 * @param expectedAudience - Expected audience
 * @throws Error if validation fails
 */
function validateInternalClaims(payload: InternalJWT, expectedAudience: string): void {
  if (payload.aud !== expectedAudience) {
    throw new Error('Invalid token audience');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  if (!payload.act || !payload.act.sub) {
    throw new Error('Missing actor claim');
  }
}

/**
 * Generates a unique request ID for tracing
 *
 * @returns UUID v4 string
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Base64url encodes a string or ArrayBuffer
 *
 * @param data - String or ArrayBuffer to encode
 * @returns Base64url encoded string
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
