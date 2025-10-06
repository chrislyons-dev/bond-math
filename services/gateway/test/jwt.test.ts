import { describe, it, expect, beforeEach } from 'vitest';
import { mintInternalToken, verifyInternalToken } from '../src/jwt';
import type { Auth0Claims } from '../src/types';

describe('JWT Module', () => {
  let mockAuth0Claims: Auth0Claims;
  const testSecret = 'test-secret-key-for-hmac-signing-minimum-32-chars';

  beforeEach(() => {
    mockAuth0Claims = {
      iss: 'https://test.auth0.com/',
      sub: 'auth0|user123',
      aud: 'https://api.bondmath.dev',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      permissions: ['pricing:read', 'valuation:read'],
    };
  });

  describe('mintInternalToken', () => {
    it('should mint a valid internal JWT', async () => {
      const token = await mintInternalToken(
        mockAuth0Claims,
        'svc-pricing',
        testSecret,
        90
      );

      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct claims in minted token', async () => {
      const token = await mintInternalToken(
        mockAuth0Claims,
        'svc-pricing',
        testSecret,
        90
      );

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64!));

      expect(payload.iss).toBe('https://gateway.bond-math');
      expect(payload.sub).toBe('svc-gateway');
      expect(payload.aud).toBe('svc-pricing');
      expect(payload.act.sub).toBe('auth0|user123');
      expect(payload.act.perms).toEqual(['pricing:read', 'valuation:read']);
      expect(payload.rid).toBeTruthy();
    });

    it('should set correct expiration time', async () => {
      const ttl = 120;
      const beforeMint = Math.floor(Date.now() / 1000);

      const token = await mintInternalToken(
        mockAuth0Claims,
        'svc-pricing',
        testSecret,
        ttl
      );

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64!));

      expect(payload.exp).toBeGreaterThanOrEqual(beforeMint + ttl);
      expect(payload.exp).toBeLessThanOrEqual(beforeMint + ttl + 2);
    });
  });

  describe('verifyInternalToken', () => {
    it('should verify a valid token', async () => {
      const token = await mintInternalToken(
        mockAuth0Claims,
        'svc-pricing',
        testSecret,
        90
      );

      const payload = await verifyInternalToken(token, testSecret, 'svc-pricing');

      expect(payload.aud).toBe('svc-pricing');
      expect(payload.act.sub).toBe('auth0|user123');
    });

    it('should reject token with invalid signature', async () => {
      const token = await mintInternalToken(
        mockAuth0Claims,
        'svc-pricing',
        testSecret,
        90
      );

      const wrongSecret = 'wrong-secret-but-still-32-chars-minimum!';

      await expect(
        verifyInternalToken(token, wrongSecret, 'svc-pricing')
      ).rejects.toThrow('Invalid token signature');
    });

    it('should reject token with wrong audience', async () => {
      const token = await mintInternalToken(
        mockAuth0Claims,
        'svc-pricing',
        testSecret,
        90
      );

      await expect(
        verifyInternalToken(token, testSecret, 'svc-valuation')
      ).rejects.toThrow('Invalid token audience');
    });

    it('should reject expired token', async () => {
      const token = await mintInternalToken(
        mockAuth0Claims,
        'svc-pricing',
        testSecret,
        -10 // Expired 10 seconds ago
      );

      await expect(
        verifyInternalToken(token, testSecret, 'svc-pricing')
      ).rejects.toThrow('Token expired');
    });

    it('should reject malformed token', async () => {
      await expect(
        verifyInternalToken('invalid.token', testSecret, 'svc-pricing')
      ).rejects.toThrow('Invalid token format');
    });
  });
});
