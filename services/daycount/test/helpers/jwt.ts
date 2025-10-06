/**
 * JWT test helpers for creating valid internal tokens
 */

/**
 * Mints a test internal JWT token for Day Count service
 * Mimics the Gateway's token minting process
 *
 * @param secret - HMAC signing secret
 * @param perms - Array of permissions/scopes to grant
 * @param options - Optional overrides
 * @returns Signed JWT token
 */
export async function mintTestToken(
  secret: string,
  perms: string[] = ['daycount:write'],
  options: {
    aud?: string;
    role?: string;
    sub?: string;
    exp?: number;
  } = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: 'https://gateway.bond-math',
    sub: 'svc-gateway',
    aud: options.aud || 'svc-daycount',
    exp: options.exp || now + 90,
    rid: 'test-request-id',
    act: {
      iss: 'https://test.auth0.com/',
      sub: options.sub || 'auth0|test123',
      role: options.role || 'professional',
      perms: perms,
      org: 'org_test',
      uid: 'usr_test',
    },
  };

  return await signJWT(payload, secret);
}

/**
 * Signs a JWT payload using HMAC-SHA256
 */
async function signJWT(payload: unknown, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    ver: '2025.10',
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
 * Base64url encodes a string or ArrayBuffer
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
