import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('dotenv', () => ({
  config: vi.fn(() => ({ parsed: {} })),
  default: { config: vi.fn(() => ({ parsed: {} })) }
}));

const REQUIRED_VARS = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

function snapshotEnv() {
  const snapshot = {};
  REQUIRED_VARS.concat(['PORT']).forEach((key) => {
    snapshot[key] = process.env[key];
  });
  return snapshot;
}

function restoreEnv(snapshot) {
  Object.entries(snapshot).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}

describe('config', () => {
  let snapshot;

  beforeEach(() => {
    snapshot = snapshotEnv();
    vi.resetModules();
  });

  afterEach(() => {
    restoreEnv(snapshot);
    vi.resetModules();
  });

  it('exposes db credentials and a numeric port', async () => {
    process.env.PORT = '4123';
    const config = (await import('../config.js')).default;

    expect(config.port).toBe(4123);
    expect(config.db).toMatchObject({
      host: 'test-host',
      port: 5432,
      database: 'test-db',
      user: 'test-user',
      password: 'test-password'
    });
    expect(config.db.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('falls back to default PORT when unset', async () => {
    process.env.PORT = '';
    const config = (await import('../config.js')).default;

    expect(config.port).toBe(8080);
  });

  it('throws when a required env var is missing', async () => {
    process.env.DB_HOST = '';
    await expect(import('../config.js')).rejects.toThrow(/DB_HOST/);
  });

  it('throws when an integer env var is malformed', async () => {
    process.env.DB_PORT = 'not-a-number';
    await expect(import('../config.js')).rejects.toThrow(/Invalid integer for DB_PORT/);
  });
});
