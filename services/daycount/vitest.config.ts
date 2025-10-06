import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        INTERNAL_JWT_SECRET: 'test-secret-key-for-hmac-signing-minimum-32-chars',
        ENVIRONMENT: 'test',
      },
      compatibilityFlags: ['streams_enable_constructors'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/dist/**',
        '**/node_modules/**',
        '**/types.ts', // Type definitions only
        '**/index.ts', // Worker handler (requires integration tests)
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
