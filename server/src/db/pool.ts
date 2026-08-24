/**
 * PostgreSQL connection pool.
 *
 * Connection parameters are read from `config/env.ts` — never from
 * `process.env` directly here. dotenv is loaded once in `config/env.ts`.
 */

import { Pool } from "pg";
import { DB } from "../config/env";

export const pool = new Pool({
  host: DB.host,
  port: DB.port,
  database: DB.database,
  user: DB.user,
  password: DB.password,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle DB client:", err);
  process.exit(1);
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW() as time");
    client.release();
    console.log(`✓ Database connected — server time: ${result.rows[0].time}`);
    return true;
  } catch (err) {
    console.error("✗ Database connection failed:", (err as Error).message);
    return false;
  }
}
