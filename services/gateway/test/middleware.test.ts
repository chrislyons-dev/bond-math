import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { logger, requestId, rateLimiter, securityHeaders, timing } from '../src/middleware';
import type { Env, Variables } from '../src/types';

describe('Middleware Module', () => {
  describe('requestId middleware', () => {
    it('should generate new request ID if not present', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use('*', requestId);
      app.get('/test', (c) => {
        const rid = c.get('requestId');
        return c.json({ requestId: rid });
      });

      const res = await app.request('/test');
      const data = (await res.json()) as { requestId: string };

      expect(res.status).toBe(200);
      expect(data.requestId).toBeTruthy();
      expect(res.headers.get('X-Request-ID')).toBe(data.requestId);
    });

    it('should use existing request ID from header', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use('*', requestId);
      app.get('/test', (c) => {
        const rid = c.get('requestId');
        return c.json({ requestId: rid });
      });

      const existingId = 'test-request-id-123';
      const res = await app.request('/test', {
        headers: { 'X-Request-ID': existingId },
      });
      const data = (await res.json()) as { requestId: string };

      expect(res.status).toBe(200);
      expect(data.requestId).toBe(existingId);
      expect(res.headers.get('X-Request-ID')).toBe(existingId);
    });
  });

  describe('securityHeaders middleware', () => {
    it('should add all security headers', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use('*', securityHeaders);
      app.get('/test', (c) => c.text('OK'));

      const res = await app.request('/test');

      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('timing middleware', () => {
    it('should add Server-Timing header', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use('*', timing);
      app.get('/test', (c) => c.text('OK'));

      const res = await app.request('/test');

      const serverTiming = res.headers.get('Server-Timing');
      expect(serverTiming).toBeTruthy();
      expect(serverTiming).toContain('total;dur=');
    });
  });

  describe('logger middleware', () => {
    it('should log request and response', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();

      app.use('*', requestId);
      app.use('*', logger);
      app.get('/test', (c) => c.text('OK'));

      await app.request('/test');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] --> GET \/test/));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] <-- GET \/test 200 \(\d+ms\)/)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('rateLimiter middleware', () => {
    beforeEach(() => {
      // Clear rate limit state between tests
      vi.useFakeTimers();
    });

    it('should allow requests within limit', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use(
        '*',
        rateLimiter({
          windowMs: 60000,
          maxRequests: 3,
        })
      );
      app.get('/test', (c) => c.text('OK'));

      // Make 3 requests - all should succeed
      for (let i = 0; i < 3; i++) {
        const res = await app.request('/test');
        expect(res.status).toBe(200);
        expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
      }
    });

    it('should block requests exceeding limit', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use(
        '*',
        rateLimiter({
          windowMs: 60000,
          maxRequests: 2,
        })
      );
      app.get('/test', (c) => c.text('OK'));

      // First 2 requests should succeed
      await app.request('/test');
      await app.request('/test');

      // Third request should be rate limited
      const res = await app.request('/test');
      expect(res.status).toBe(429);

      const data = (await res.json()) as { title: string; status: number };
      expect(data.title).toBe('Too Many Requests');
      expect(data.status).toBe(429);
    });

    it('should include rate limit headers', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use(
        '*',
        rateLimiter({
          windowMs: 60000,
          maxRequests: 5,
        })
      );
      app.get('/test', (c) => c.text('OK'));

      const res = await app.request('/test');

      expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('should reset counter after window expires', async () => {
      vi.useRealTimers(); // Use real timers for this test

      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use(
        '*',
        rateLimiter({
          windowMs: 100, // 100ms window
          maxRequests: 1,
        })
      );
      app.get('/test', (c) => c.text('OK'));

      // First request succeeds
      const res1 = await app.request('/test');
      expect(res1.status).toBe(200);

      // Second request blocked
      const res2 = await app.request('/test');
      expect(res2.status).toBe(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Third request succeeds (new window)
      const res3 = await app.request('/test');
      expect(res3.status).toBe(200);
    });

    it('should use userId from context if available', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();

      // Middleware to set userId
      app.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        await next();
      });

      app.use(
        '*',
        rateLimiter({
          windowMs: 60000,
          maxRequests: 2,
        })
      );
      app.get('/test', (c) => c.text('OK'));

      // Make requests as user-123
      const res1 = await app.request('/test');
      expect(res1.status).toBe(200);

      const res2 = await app.request('/test');
      expect(res2.status).toBe(200);

      const res3 = await app.request('/test');
      expect(res3.status).toBe(429);
    });
  });

  describe('middleware integration', () => {
    it('should work together in proper order', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();

      app.use('*', requestId);
      app.use('*', securityHeaders);
      app.use('*', timing);
      app.use(
        '*',
        rateLimiter({
          windowMs: 60000,
          maxRequests: 10,
        })
      );

      app.get('/test', (c) => {
        return c.json({
          requestId: c.get('requestId'),
          message: 'OK',
        });
      });

      const res = await app.request('/test');
      const data = (await res.json()) as { requestId: string; message: string };

      // Check all middleware effects
      expect(res.status).toBe(200);
      expect(data.requestId).toBeTruthy();
      expect(res.headers.get('X-Request-ID')).toBe(data.requestId);
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Server-Timing')).toBeTruthy();
      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    });
  });
});
