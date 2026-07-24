import { Pool } from 'pg';
import { dbEnv } from '../config/db-env.js';

export const pool = new Pool({ connectionString: dbEnv.DATABASE_URL });

export async function pingDb(): Promise<void> {
  await pool.query('SELECT 1');
}
