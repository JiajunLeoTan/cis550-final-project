import { vi } from 'vitest';

process.env.DB_HOST = 'test-host';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test-db';
process.env.DB_USER = 'test-user';
process.env.DB_PASSWORD = 'test-password';
process.env.PORT = '0';
process.env.CLIENT_ORIGIN = '';

vi.spyOn(console, 'error').mockImplementation(() => {});
