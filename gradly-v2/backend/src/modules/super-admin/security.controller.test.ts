import assert from "node:assert/strict";
import test from "node:test";
import type { Response } from "express";

type QueryResult = { rows: Array<Record<string, any>> };
type QueryFunction = (query: string, values?: unknown[]) => Promise<QueryResult>;

async function loadController() {
  process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/gradly_test";
  process.env.FIREBASE_PROJECT_ID = "gradly-test";
  process.env.FIREBASE_CLIENT_EMAIL = "gradly-test@example.invalid";
  process.env.FIREBASE_PRIVATE_KEY = "test-only-key";
  const { pool } = await import("../../config/database");
  const { getSuperAdminSecurityEvents } = await import("./security.controller");
  return { pool, getSuperAdminSecurityEvents };
}

function mockResponse() {
  let statusCode = 200;
  let payload: unknown;
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { payload = body; return this; },
  };
  return {
    response: response as unknown as Response,
    get statusCode() { return statusCode; },
    get payload() { return payload as Record<string, any>; },
  };
}

test("security feed returns persisted login events with derived lockout severity", async () => {
  const { pool, getSuperAdminSecurityEvents } = await loadController();
  const queryable = pool as unknown as { query: QueryFunction };
  const originalQuery = queryable.query;
  const calls: Array<{ query: string; values: unknown[] }> = [];
  queryable.query = async (query, values = []) => {
    calls.push({ query, values });
    if (query.includes("COUNT(*)::int AS total")) return { rows: [{ total: 2 }] };
    if (query.includes("failedLast24Hours")) {
      return { rows: [{ failedLast24Hours: 4, successfulLast24Hours: 7 }] };
    }
    return {
      rows: [{
        id: "event-1",
        principalType: "SUPER_ADMIN",
        principalId: "admin-1",
        success: false,
        ipAddress: "192.0.2.4",
        failureReason: "INVALID_CREDENTIALS",
        createdAt: new Date().toISOString(),
        lockoutLevel: 1,
        lockedUntil: new Date(Date.now() + 60_000).toISOString(),
      }],
    };
  };

  try {
    const res = mockResponse();
    await getSuperAdminSecurityEvents({
      query: { limit: "25", offset: "0", principalType: "SUPER_ADMIN", outcome: "failed", search: "admin-1" },
    } as never, res.response);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.data.summary.failedLast24Hours, 4);
    assert.equal(res.payload.data.summary.successfulLast24Hours, 7);
    assert.equal(res.payload.data.items[0].severity, "HIGH");
    assert.equal(res.payload.data.items[0].principalId, "admin-1");
    assert.equal(calls.length, 3);
    assert.ok(calls.every((call) => !call.query.includes("device_fingerprint_hash")));
    assert.ok(calls[0].values.includes("%admin-1%"));
  } finally {
    queryable.query = originalQuery;
  }
});

test("security feed does not expose database errors", async () => {
  const { pool, getSuperAdminSecurityEvents } = await loadController();
  const queryable = pool as unknown as { query: QueryFunction };
  const originalQuery = queryable.query;
  queryable.query = async () => { throw new Error("internal database details"); };

  try {
    const res = mockResponse();
    await getSuperAdminSecurityEvents({ query: {} } as never, res.response);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, {
      success: false,
      message: "Security events are temporarily unavailable.",
    });
  } finally {
    queryable.query = originalQuery;
  }
});
