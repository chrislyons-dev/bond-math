/**
 * Scope-based authorization tests
 * Verifies OAuth 2.0 scope enforcement for Day Count service
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { mintTestToken } from './helpers/jwt';

// Import the Hono app
const app = await import('../src/index');

const TEST_SECRET = 'test-secret-for-scope-validation';

describe('Scope-Based Authorization', () => {
  let validToken: string;
  let readOnlyToken: string;
  let noScopesToken: string;

  beforeAll(async () => {
    // Token with daycount:write scope (should succeed)
    validToken = await mintTestToken(TEST_SECRET, ['daycount:write']);

    // Token with only daycount:read scope (should fail)
    readOnlyToken = await mintTestToken(TEST_SECRET, ['daycount:read']);

    // Token with no scopes (should fail)
    noScopesToken = await mintTestToken(TEST_SECRET, []);
  });

  test('should allow request with daycount:write scope', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(200);

    const body: { results?: unknown[] } = await response.json();
    expect(body.results).toBeDefined();
    expect(body.results).toHaveLength(1);
  });

  test('should reject request with only daycount:read scope', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readOnlyToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.message).toContain('Insufficient permissions');
    expect(body.message).toContain('daycount:write');
  });

  test('should reject request with no scopes', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${noScopesToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.message).toContain('Insufficient permissions');
    expect(body.message).toContain('daycount:write');
  });

  test('should reject request with invalid token', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token',
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.message).toContain('Invalid token');
  });

  test('should reject request with expired token', async () => {
    // Create a token that expired 10 seconds ago
    const expiredToken = await mintTestToken(TEST_SECRET, ['daycount:write'], {
      exp: Math.floor(Date.now() / 1000) - 10,
    });

    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expiredToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.message).toContain('Token expired');
  });

  test('should reject request with wrong audience', async () => {
    // Create a token for a different service
    const wrongAudToken = await mintTestToken(TEST_SECRET, ['daycount:write'], {
      aud: 'svc-valuation',
    });

    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wrongAudToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.message).toContain('Invalid token audience');
  });

  test('should allow health check without authentication', async () => {
    const request = new Request('http://localhost/health', {
      method: 'GET',
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('daycount');
  });

  test('should include role in actor claim', async () => {
    const professionalToken = await mintTestToken(TEST_SECRET, ['daycount:write'], {
      role: 'professional',
    });

    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${professionalToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(200);

    // Token should have been validated with role
    const body = await response.json();
    expect(body.results).toBeDefined();
  });
});
