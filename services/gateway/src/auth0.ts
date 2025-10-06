/**
 * Auth0 token verification module
 * Follows Single Responsibility Principle - handles only Auth0 JWKS verification
 *
 * @module auth0
 */

import type { JWKS, JWK, Auth0Claims } from './types';

interface JWTHeader {
  alg: string;
  typ: string;
  kid: string;
}

/**
 * Verifies an Auth0 JWT token using JWKS verification
 *
 * @param token - Auth0 access token
 * @param domain - Auth0 domain (e.g., "your-tenant.auth0.com")
 * @param audience - Expected audience claim
 * @returns Decoded and verified token claims
 * @throws Error if verification fails
 */
export async function verifyAuth0Token(
  token: string,
  domain: string,
  audience: string
): Promise<Auth0Claims> {
  // Split token into parts
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const headerB64 = parts[0];
  const payloadB64 = parts[1];

  if (!headerB64 || !payloadB64) {
    throw new Error('Invalid token format');
  }

  // Decode header and payload
  const header = JSON.parse(atob(headerB64)) as JWTHeader;
  const payload = JSON.parse(atob(payloadB64)) as Auth0Claims;

  // Validate basic claims
  validateTokenClaims(payload, domain, audience);

  // Fetch JWKS and verify signature
  const jwk = await fetchJWK(domain, header.kid);
  await verifySignature(token, jwk);

  return payload;
}

/**
 * Validates token claims (issuer, audience, expiration)
 * Low cyclomatic complexity - simple validations
 *
 * @param claims - Token claims to validate
 * @param domain - Expected Auth0 domain
 * @param audience - Expected audience
 * @throws Error if any validation fails
 */
function validateTokenClaims(claims: Auth0Claims, domain: string, audience: string): void {
  const expectedIssuer = `https://${domain}/`;

  if (claims.iss !== expectedIssuer) {
    throw new Error('Invalid token issuer');
  }

  const audienceArray = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audienceArray.includes(audience)) {
    throw new Error('Invalid token audience');
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp < now) {
    throw new Error('Token expired');
  }
}

/**
 * Fetches a specific JWK from Auth0's JWKS endpoint
 *
 * @param domain - Auth0 domain
 * @param kid - Key ID from token header
 * @returns JSON Web Key
 * @throws Error if key not found or fetch fails
 */
async function fetchJWK(domain: string, kid: string): Promise<JWK> {
  const jwksUrl = `https://${domain}/.well-known/jwks.json`;

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch(jwksUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BondMath-Gateway/2025.10',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.status} ${response.statusText}`);
    }

    const jwks: JWKS = await response.json();
    const key = jwks.keys.find((k) => k.kid === kid);

    if (!key) {
      throw new Error('Key not found in JWKS');
    }

    return key;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('JWKS fetch timeout after 5 seconds');
    }
    throw error;
  }
}

/**
 * Verifies JWT signature using Web Crypto API
 *
 * @param token - Full JWT token
 * @param jwk - JSON Web Key for verification
 * @throws Error if signature verification fails
 */
async function verifySignature(token: string, jwk: JWK): Promise<void> {
  // Import public key
  const cryptoKey = await importPublicKey(jwk);

  // Split token for verification
  const parts = token.split('.');
  const headerB64 = parts[0];
  const payloadB64 = parts[1];
  const signatureB64 = parts[2];

  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error('Invalid token format');
  }

  const data = `${headerB64}.${payloadB64}`;
  const signature = base64UrlDecode(signatureB64);

  // Verify signature
  const encoder = new TextEncoder();
  const verified = await crypto.subtle.verify(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    cryptoKey,
    signature,
    encoder.encode(data)
  );

  if (!verified) {
    throw new Error('Invalid token signature');
  }
}

/**
 * Imports a JWK as a CryptoKey for signature verification
 *
 * @param jwk - JSON Web Key
 * @returns CryptoKey for verification
 */
async function importPublicKey(jwk: JWK): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: 'RS256',
      ext: true,
    },
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    ['verify']
  );
}

/**
 * Decodes a base64url encoded string
 *
 * @param str - Base64url encoded string
 * @returns Decoded Uint8Array
 */
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Extracts bearer token from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns Bearer token or null
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}
