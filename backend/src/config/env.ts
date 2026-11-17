import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/inventory_db?schema=public',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'industrial_inventory_access_secret_key_2026_secure',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'industrial_inventory_refresh_secret_key_2026_secure',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '8h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  TIMEZONE: process.env.TIMEZONE || 'Asia/Kolkata',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:4200'
};
