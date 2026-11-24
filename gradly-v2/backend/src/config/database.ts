import pg from "pg";
import { env } from "./env";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,

  ssl: {
    rejectUnauthorized: false,
  },

  // Supabase shared session mode has a finite client limit. Keep each
  // application process small and avoid periodic socket churn.
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  // Leave maxLifetimeSeconds at pg-pool's default (0 = no forced rotation).
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
  "EAI_AGAIN", "08000", "08003", "08006", "08001", "57P01", "57P02", "57P03",
  "EMAXCONNSESSION",
]);

/** pg-pool can wrap a socket or Supavisor error, so inspect the full cause chain. */
function isTransientDatabaseError(error: unknown): boolean {
  const pending: unknown[] = [error];
  const visited = new Set<unknown>();

  while (pending.length) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);

    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    const code = String(candidate.code || "");
    const message = String(candidate.message || "");
    if (
      TRANSIENT_DATABASE_CODES.has(code) ||
      /connection terminated due to connection timeout|connection terminated unexpectedly|timeout expired|connection timed out|socket hang up|max clients reached in session mode|too many clients|remaining connection slots are reserved/i.test(message)
    ) {
      return true;
    }
    if (candidate.cause) pending.push(candidate.cause);
  }

  return false;
}

/**
 * Retry idempotent database reads after transient pool/network failures.
 * Do not use this helper for INSERT/UPDATE/DELETE or other side effects.
 */
export async function queryWithRetry(text: string, values?: unknown[]) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await pool.query(text, values as never[] | undefined);
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === 3) throw error;
      // Back off instead of immediately adding more connection pressure.
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
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
