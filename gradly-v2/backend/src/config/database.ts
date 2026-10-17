
import pg from "pg";
import { env } from "./env";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,

  ssl: {
    rejectUnauthorized: false,
  },

  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL client connected.");
});

pool.on("error", (error) => {
  console.error("❌ PostgreSQL pool error:", error);
});

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
