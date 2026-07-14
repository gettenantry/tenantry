import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.spec.ts'],
    // Testcontainers pulls a real PostgreSQL image on first run.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
