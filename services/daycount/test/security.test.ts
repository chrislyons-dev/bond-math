/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Integration tests with dynamic response types
import { describe, test, expect, beforeAll } from 'vitest';
import { mintTestToken } from './helpers/jwt';

/**
 * Security and input validation tests
 *
 * These tests verify that the service properly validates inputs
 * and protects against various attack vectors.
 */

// Import the Hono app
const app = await import('../src/index');

const TEST_SECRET = 'test-secret-for-internal-jwt-verification';
let validToken: string;

describe('Input Validation Security', () => {
  beforeAll(async () => {
    // Mint a valid token for tests that need auth
    validToken = await mintTestToken(TEST_SECRET);
  });
  test('should reject requests with too many pairs (DoS prevention)', async () => {
    const largePairs = Array.from({ length: 1001 }, () => ({
      start: '2025-01-01',
      end: '2025-12-31',
    }));

    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: largePairs,
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(400);

    const body: ErrorBody = await response.json();
    expect(body.title).toBe('Validation Error');
    expect(body.detail).toContain('Maximum 1000 pairs per request');
  });

  test('should reject non-string convention (type confusion attack)', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: { malicious: 'object' },
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.title).toBe('Validation Error');
    expect(body.detail).toContain('Must be a string value');
  });

  test('should reject non-string dates in pairs', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: 12345, end: 67890 }],
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.errors).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(body.errors![0]!.message).toContain('string dates');
  });

  test('should reject invalid date format (injection prevention)', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: "2025-01-01'; DROP TABLE users; --", end: '2025-12-31' }],
        convention: 'ACT_360',
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.errors).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(body.errors![0]!.message).toContain('Invalid date format');
  });

  test('should reject options as array', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_360',
        options: ['malicious', 'array'],
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.detail).toContain('Must be an object with optional');
  });

  test('should reject invalid eomRule type', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: '30_360',
        options: { eomRule: 'true' }, // String instead of boolean
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(400);

    const body = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(body.errors![0]!.field).toBe('options.eomRule');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(body.errors![0]!.message).toContain('boolean');
  });

  test('should reject invalid frequency type', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_ACT_ICMA',
        options: { frequency: '2' }, // String instead of number
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(400);

    const body = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(body.errors![0]!.field).toBe('options.frequency');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(body.errors![0]!.message).toContain('positive number');
  });

  test('should reject negative frequency', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_ACT_ICMA',
        options: { frequency: -1 },
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(400);

    const body = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(body.errors![0]!.message).toContain('positive number');
  });

  test('should accept valid request with all security checks passing', async () => {
    const request = new Request('http://localhost/count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        pairs: [{ start: '2025-01-01', end: '2025-12-31' }],
        convention: 'ACT_360',
        options: { eomRule: true, frequency: 2 },
      }),
    });

    const response = await app.default.fetch(request, { INTERNAL_JWT_SECRET: TEST_SECRET });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.results).toBeDefined();
    expect(body.results.length).toBe(1);
  });
});
