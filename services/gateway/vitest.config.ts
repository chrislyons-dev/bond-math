import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        INTERNAL_JWT_SECRET: 'test-secret-key-for-hmac-signing-minimum-32-chars',
        AUTH0_DOMAIN: 'test.auth0.com',
        AUTH0_AUDIENCE: 'https://api.bondmath.dev',
        INTERNAL_JWT_TTL: '90',
        ENVIRONMENT: 'test',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      exclude: ['node_modules/', 'test/', '*.config.ts'],
    },
  },
});
