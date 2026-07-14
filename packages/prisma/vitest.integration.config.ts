import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.spec.ts'],
    // No integration tests yet (they land with the v1 implementation).
    passWithNoTests: true,
    // Testcontainers pulls a real PostgreSQL image on first run.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
