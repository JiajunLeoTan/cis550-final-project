const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

function parseInteger(value, fallback, label) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${label}: ${value}`);
  }

  return parsed;
}

function parseClientOrigins(value) {
  if (!value) {
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

module.exports = {
  port: parseInteger(process.env.PORT, 8080, 'PORT'),
  clientOrigins: parseClientOrigins(process.env.CLIENT_ORIGIN),
  db: {
    host: process.env.DB_HOST,
    port: parseInteger(process.env.DB_PORT, 5432, 'DB_PORT'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  }
};
