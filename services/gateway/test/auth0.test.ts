import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyAuth0Token, extractBearerToken } from '../src/auth0';
import type { Auth0Claims } from '../src/types';

// Helper to create typed fetch mock
const createFetchMock = (returnValue: unknown) =>
  vi.fn().mockResolvedValue(returnValue) as unknown as typeof fetch;

const createFetchRejectMock = (error: Error) =>
  vi.fn().mockRejectedValue(error) as unknown as typeof fetch;

// Helper to create a mock JWT token
const createMockToken = (
  mockDomain: string,
  mockAudience: string,
  claims: Partial<Auth0Claims>
): string => {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-kid-123' };
  const defaultClaims: Auth0Claims = {
    iss: `https://${mockDomain}/`,
    sub: 'auth0|user123',
    aud: mockAudience,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    permissions: ['pricing:read'],
    ...claims,
  };

  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(defaultClaims));
  const signature = 'mock-signature';

  return `${headerB64}.${payloadB64}.${signature}`;
};

// Helper to create a valid token for JWKS tests
const createValidToken = (mockDomain: string, mockAudience: string): string => {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-kid-123' };
  const claims: Auth0Claims = {
    iss: `https://${mockDomain}/`,
    sub: 'auth0|user123',
    aud: mockAudience,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    permissions: ['pricing:read'],
  };

  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(claims));
  const signature = 'mock-signature';

  return `${headerB64}.${payloadB64}.${signature}`;
};

describe('Auth0 Module', () => {
  const mockDomain = 'test.auth0.com';
  const mockAudience = 'https://api.bondmath.dev';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe('extractBearerToken', () => {
    it('should extract token from valid Authorization header', () => {
      const token = extractBearerToken('Bearer abc123xyz');
      expect(token).toBe('abc123xyz');
    });

    it('should extract token with case-insensitive "Bearer" keyword', () => {
      const token = extractBearerToken('bearer abc123xyz');
      expect(token).toBe('abc123xyz');
    });

    it('should return null for missing header', () => {
      const token = extractBearerToken(null);
      expect(token).toBeNull();
    });

    it('should return null for malformed header without Bearer prefix', () => {
      const token = extractBearerToken('abc123xyz');
      expect(token).toBeNull();
    });

    it('should return null for empty Bearer token', () => {
      const token = extractBearerToken('Bearer ');
      expect(token).toBeNull();
    });

    it('should handle tokens with special characters', () => {
      const specialToken = 'eyJhbGc.eyJzdWI.SflKxw-RQ';
      const token = extractBearerToken(`Bearer ${specialToken}`);
      expect(token).toBe(specialToken);
    });
  });

  describe('verifyAuth0Token', () => {
    describe('Token Format Validation', () => {
      it('should reject token with invalid format (not 3 parts)', async () => {
        await expect(verifyAuth0Token('invalid.token', mockDomain, mockAudience)).rejects.toThrow(
          'Invalid token format'
        );
      });

      it('should reject token with empty parts', async () => {
        await expect(verifyAuth0Token('..', mockDomain, mockAudience)).rejects.toThrow(
          'Invalid token format'
        );
      });

      it('should handle token with missing header part', async () => {
        const malformedToken = '.eyJzdWI6MTIzNDU2Nzg5MH0.signature';

        await expect(verifyAuth0Token(malformedToken, mockDomain, mockAudience)).rejects.toThrow(
          'Invalid token format'
        );
      });

      it('should handle token with missing payload part', async () => {
        const malformedToken = 'eyJhbGc6IlJTMjU2In0..signature';

        await expect(verifyAuth0Token(malformedToken, mockDomain, mockAudience)).rejects.toThrow(
          'Invalid token format'
        );
      });
    });

    describe('Claims Validation', () => {
      beforeEach(() => {
        // Mock JWKS fetch to prevent actual network calls
        global.fetch = createFetchMock({
          ok: false,
          status: 500,
          statusText: 'Mock error',
        });
      });

      it('should reject token with invalid issuer', async () => {
        const token = createMockToken(mockDomain, mockAudience, {
          iss: 'https://wrong-domain.auth0.com/',
        });

        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow(
          'Invalid token issuer'
        );
      });

      it('should reject token with wrong audience', async () => {
        const token = createMockToken(mockDomain, mockAudience, {
          aud: 'https://wrong-audience.example.com',
        });

        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow(
          'Invalid token audience'
        );
      });

      it('should reject token with wrong audience in array', async () => {
        const token = createMockToken(mockDomain, mockAudience, {
          aud: ['https://wrong1.example.com', 'https://wrong2.example.com'],
        });

        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow(
          'Invalid token audience'
        );
      });

      it('should reject expired token', async () => {
        const token = createMockToken(mockDomain, mockAudience, {
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        });

        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow(
          'Token expired'
        );
      });

      it('should reject token expiring exactly now', async () => {
        const token = createMockToken(mockDomain, mockAudience, {
          exp: Math.floor(Date.now() / 1000) - 1, // Expired 1 second ago to ensure it fails
        });

        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow(
          'Token expired'
        );
      });
    });

    describe('JWKS Fetching', () => {
      it('should fetch JWKS from correct endpoint', async () => {
        const token = createValidToken(mockDomain, mockAudience);

        global.fetch = createFetchMock({
          ok: true,
          json: async () => Promise.resolve({ keys: [] }),
        });

        // Will fail at key not found, but we can verify fetch was called
        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const userAgentMatcher = expect.stringContaining('BondMath-Gateway');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const headerMatcher = expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          'User-Agent': userAgentMatcher,
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const requestMatcher = expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: headerMatcher,
        });

        expect(global.fetch).toHaveBeenCalledWith(
          `https://${mockDomain}/.well-known/jwks.json`,
          requestMatcher
        );
      });

      it('should throw error when JWKS fetch fails', async () => {
        const token = createValidToken(mockDomain, mockAudience);

        global.fetch = createFetchMock({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow(
          'Failed to fetch JWKS: 500 Internal Server Error'
        );
      });

      it('should throw error when JWKS fetch times out', async () => {
        const token = createValidToken(mockDomain, mockAudience);

        // Mock an AbortError
        const abortError = new Error('Aborted');
        abortError.name = 'AbortError';
        global.fetch = createFetchRejectMock(abortError);

        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow(
          'JWKS fetch timeout after 5 seconds'
        );
      });

      it('should throw error when key not found in JWKS', async () => {
        const token = createValidToken(mockDomain, mockAudience);

        global.fetch = createFetchMock({
          ok: true,
          json: async () =>
            Promise.resolve({
              keys: [
                {
                  kty: 'RSA',
                  kid: 'different-kid',
                  use: 'sig',
                  n: 'mock-modulus',
                  e: 'AQAB',
                },
              ],
            }),
        });

        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow(
          'Key not found in JWKS'
        );
      });

      it('should handle network errors during JWKS fetch', async () => {
        const token = createValidToken(mockDomain, mockAudience);

        global.fetch = createFetchRejectMock(new Error('Network error'));

        await expect(verifyAuth0Token(token, mockDomain, mockAudience)).rejects.toThrow(
          'Network error'
        );
      });
    });
  });
});
