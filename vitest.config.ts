import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Self-executing tsx scripts with their own npm scripts
    // (test:uae-transfer etc.), not vitest suites.
    exclude: ['tests/uae-*.test.ts', 'tests/relay-*.test.ts', '**/node_modules/**'],
  },
});
