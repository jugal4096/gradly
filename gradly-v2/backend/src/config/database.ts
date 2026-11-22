
import pg from "pg";
import { env } from "./env";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,

  ssl: {
    rejectUnauthorized: false,
  },

  // Keep the pool deliberately small and retire long-lived sockets so a
  // Supabase pooler/network idle timeout does not leave stale clients around.
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
  maxLifetimeSeconds: 300,
  keepAlive: true,
  keepAliveInitialDelayMillis: 5000,
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL client connected.");
});

pool.on("error", (error) => {
  console.error("❌ PostgreSQL pool error:", error);
});

const TRANSIENT_DATABASE_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "ENOTFOUND",
  "08000", "08003", "08006", "08001", "57P01", "57P02", "57P03",
]);

/**
 * Retry idempotent database reads after transient pool/network failures.
 * Do not use this helper for INSERT/UPDATE/DELETE or other side effects.
 */
export async function queryWithRetry(text: string, values?: unknown[]) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await pool.query(text, values as any[] | undefined);
    } catch (error) {
      lastError = error;
      const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
      if (!TRANSIENT_DATABASE_CODES.has(code) || attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 300));
    }
  }
  throw lastError;
}

export async function testDatabaseConnection() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        NOW() AS current_time,
        current_database() AS database_name,
        current_schema() AS schema_name,
        current_user AS database_user
    `);

    return result.rows[0];
  } finally {
    client.release();
  }
}
