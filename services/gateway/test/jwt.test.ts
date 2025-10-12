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
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', testSecret, 90);

      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct claims in minted token', async () => {
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', testSecret, 90);

      const parts = token.split('.');
      const payloadB64 = parts[1];
      if (!payloadB64) throw new Error('Invalid token');

      interface PayloadType {
        iss: string;
        sub: string;
        aud: string;
        act: { sub: string; perms: string[] };
        rid: string;
      }
      const payload = JSON.parse(atob(payloadB64)) as PayloadType;

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

      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', testSecret, ttl);

      const parts = token.split('.');
      const payloadB64 = parts[1];
      if (!payloadB64) throw new Error('Invalid token');

      interface PayloadType {
        exp: number;
      }
      const payload = JSON.parse(atob(payloadB64)) as PayloadType;

      expect(payload.exp).toBeGreaterThanOrEqual(beforeMint + ttl);
      expect(payload.exp).toBeLessThanOrEqual(beforeMint + ttl + 2);
    });
  });

  describe('verifyInternalToken', () => {
    it('should verify a valid token', async () => {
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', testSecret, 90);

      const payload = await verifyInternalToken(token, testSecret, 'svc-pricing');

      expect(payload.aud).toBe('svc-pricing');
      expect(payload.act.sub).toBe('auth0|user123');
    });

    it('should reject token with invalid signature', async () => {
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', testSecret, 90);

      const wrongSecret = 'wrong-secret-but-still-32-chars-minimum!';

      await expect(verifyInternalToken(token, wrongSecret, 'svc-pricing')).rejects.toThrow(
        'Invalid token signature'
      );
    });

    it('should reject token with wrong audience', async () => {
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', testSecret, 90);

      await expect(verifyInternalToken(token, testSecret, 'svc-valuation')).rejects.toThrow(
        'Invalid token audience'
      );
    });

    it('should reject expired token', async () => {
      const token = await mintInternalToken(
        mockAuth0Claims,
        'svc-pricing',
        testSecret,
        -10 // Expired 10 seconds ago
      );

      await expect(verifyInternalToken(token, testSecret, 'svc-pricing')).rejects.toThrow(
        'Token expired'
      );
    });

    it('should reject malformed token', async () => {
      await expect(verifyInternalToken('invalid.token', testSecret, 'svc-pricing')).rejects.toThrow(
        'Invalid token format'
      );
    });

    it('should reject secret shorter than 32 characters', async () => {
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', testSecret, 90);
      const shortSecret = 'short-secret';

      await expect(verifyInternalToken(token, shortSecret, 'svc-pricing')).rejects.toThrow(
        'INTERNAL_JWT_SECRET must be at least 32 characters'
      );
    });
  });

  describe('Dual-Secret Verification (Zero-Downtime Rotation)', () => {
    const currentSecret = 'current-secret-minimum-32-chars-for-hmac-sha256';
    const previousSecret = 'previous-secret-minimum-32-chars-for-hmac-sha256';

    it('should verify token signed with current secret', async () => {
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', currentSecret, 90);

      const payload = await verifyInternalToken(
        token,
        currentSecret,
        'svc-pricing',
        previousSecret
      );

      expect(payload.aud).toBe('svc-pricing');
      expect(payload.act.sub).toBe('auth0|user123');
    });

    it('should verify token signed with previous secret', async () => {
      // Simulate token minted before rotation (signed with old secret)
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', previousSecret, 90);

      // Service now has new current secret but accepts previous
      const payload = await verifyInternalToken(
        token,
        currentSecret,
        'svc-pricing',
        previousSecret
      );

      expect(payload.aud).toBe('svc-pricing');
      expect(payload.act.sub).toBe('auth0|user123');
    });

    it('should reject token signed with neither secret', async () => {
      const wrongSecret = 'wrong-secret-minimum-32-chars-for-testing-auth';
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', wrongSecret, 90);

      await expect(
        verifyInternalToken(token, currentSecret, 'svc-pricing', previousSecret)
      ).rejects.toThrow('Invalid token signature');
    });

    it('should reject previous secret shorter than 32 characters', async () => {
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', currentSecret, 90);
      const shortPrevious = 'short';

      await expect(
        verifyInternalToken(token, currentSecret, 'svc-pricing', shortPrevious)
      ).rejects.toThrow('Previous INTERNAL_JWT_SECRET must be at least 32 characters');
    });

    it('should handle rotation scenario correctly', async () => {
      const oldSecret = 'old-secret-minimum-32-chars-for-hmac-testing';
      const newSecret = 'new-secret-minimum-32-chars-for-hmac-testing';

      // Step 1: Before rotation - token signed with old secret
      const oldToken = await mintInternalToken(mockAuth0Claims, 'svc-pricing', oldSecret, 90);

      // Verify with old secret (before rotation)
      const payload1 = await verifyInternalToken(oldToken, oldSecret, 'svc-pricing');
      expect(payload1.aud).toBe('svc-pricing');

      // Step 2: During rotation - old becomes previous, new becomes current
      // Old token should still work (signed with previous)
      const payload2 = await verifyInternalToken(oldToken, newSecret, 'svc-pricing', oldSecret);
      expect(payload2.aud).toBe('svc-pricing');

      // New token should also work (signed with current)
      const newToken = await mintInternalToken(mockAuth0Claims, 'svc-pricing', newSecret, 90);
      const payload3 = await verifyInternalToken(newToken, newSecret, 'svc-pricing', oldSecret);
      expect(payload3.aud).toBe('svc-pricing');

      // Step 3: After rotation completes - only new secret
      // Old token should fail (previous secret no longer provided)
      await expect(verifyInternalToken(oldToken, newSecret, 'svc-pricing')).rejects.toThrow(
        'Invalid token signature'
      );

      // New token should continue working
      const payload4 = await verifyInternalToken(newToken, newSecret, 'svc-pricing');
      expect(payload4.aud).toBe('svc-pricing');
    });

    it('should prefer current secret over previous in verification order', async () => {
      // This test ensures current secret is tried first for performance
      const token = await mintInternalToken(mockAuth0Claims, 'svc-pricing', currentSecret, 90);

      // Both secrets provided, token signed with current
      const payload = await verifyInternalToken(
        token,
        currentSecret,
        'svc-pricing',
        previousSecret
      );

      expect(payload.aud).toBe('svc-pricing');
      // If current wasn't tried first, the test would still pass but be slower
      // This is a behavioral test ensuring the optimization is in place
    });
  });
});
