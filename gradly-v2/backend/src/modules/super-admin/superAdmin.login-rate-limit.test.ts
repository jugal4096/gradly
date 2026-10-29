import assert from "node:assert/strict";
import test from "node:test";
type QueryResult = { rows: Array<Record<string, unknown>> };
type QueryFunction = (query: string, values?: unknown[]) => Promise<QueryResult>;
async function load() {
  process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/gradly_test";
  process.env.FIREBASE_PROJECT_ID = "gradly-test";
  process.env.FIREBASE_CLIENT_EMAIL = "gradly-test@example.invalid";
  process.env.FIREBASE_PRIVATE_KEY = "test-only-key";
  const { pool } = await import("../../config/database");
  const { isSuperAdminLoginRateLimited } = await import("./superAdmin.login-rate-limit");
  return { pool, isSuperAdminLoginRateLimited };
}
test("blocks an IP at ten persisted failures in fifteen minutes", async () => {
  const { pool, isSuperAdminLoginRateLimited } = await load();
  const db = pool as unknown as { query: QueryFunction }; const original = db.query;
  let query = ""; let values: unknown[] = [];
  db.query = async (sql, params = []) => { query = sql; values = params; return { rows: [{ failed_attempts: 10 }] }; };
  try {
    assert.equal(await isSuperAdminLoginRateLimited("192.0.2.8"), true);
    assert.ok(query.includes("success = FALSE"));
    assert.ok(query.includes("ip_address = $1::inet"));
    assert.ok(query.includes("15 minutes"));
    assert.deepEqual(values, ["192.0.2.8"]);
  } finally { db.query = original; }
});
test("allows an IP with fewer than ten persisted failures", async () => {
  const { pool, isSuperAdminLoginRateLimited } = await load();
  const db = pool as unknown as { query: QueryFunction }; const original = db.query;
  db.query = async () => ({ rows: [{ failed_attempts: 9 }] });
  try { assert.equal(await isSuperAdminLoginRateLimited("192.0.2.8"), false); }
  finally { db.query = original; }
});
