import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: here,
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: [resolve(here, 'tests/setup.js')],
    include: ['tests/**/*.test.{js,jsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/**/*.test.{js,jsx}',
        'tests/**',
        'src/styles/**'
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75
      }
    }
  }
});
