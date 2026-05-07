import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sequential execution: Layer 3 has cross-step shared state, and we don't
    // want the three test files racing each other against the same backend.
    fileParallelism: false,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // 30s default — Layer 3 step 5 waits for Caddy on-demand TLS to mint a
    // cert for the new handle subdomain.
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['verbose'],
    include: ['src/tests/**/*.test.ts'],
  },
});
