import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // WSL2 + Windows-mounted (/mnt/c) filesystems are slow for cold module
    // transforms; the 5s default can be exceeded before any test logic runs.
    testTimeout: 30000,
  },
});
