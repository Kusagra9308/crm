import 'dotenv/config'
import { Pool } from 'pg';

// Suppress SSL warning for self-signed certificates in development
// In production, remove this and use proper certificates
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }   // strict in prod
    : { rejectUnauthorized: false }, // allow self-signed in dev
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export default pool;