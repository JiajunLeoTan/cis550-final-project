const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['server/**/*.js'],
      exclude: [
        'server/index.js',
        'server/db.js',
        'server/queries/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
});
