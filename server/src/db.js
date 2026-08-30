import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// Render's managed Postgres requires SSL in production but not for local dev.
const useSsl = process.env.DATABASE_URL && process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

export async function query(text, params) {
  return pool.query(text, params);
}

// Run a set of statements inside a single transaction. `fn` receives a
// client with the same `.query` signature as the pool.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
