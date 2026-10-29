import assert from "node:assert/strict";
import test from "node:test";
import type { Response } from "express";

type QueryResult = { rows: Array<Record<string, unknown>> };
type QueryFunction = (query: string, values?: unknown[]) => Promise<QueryResult>;

async function loadController() {
  process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/gradly_test";
  process.env.FIREBASE_PROJECT_ID = "gradly-test";
  process.env.FIREBASE_CLIENT_EMAIL = "gradly-test@example.invalid";
  process.env.FIREBASE_PRIVATE_KEY = "test-only-key";

  const { pool } = await import("../../config/database");
  const { getSuperAdminAuditLogs } = await import("./audit.controller");
  return { pool, getSuperAdminAuditLogs };
}

function mockResponse() {
  let statusCode = 200;
  let payload: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  };
  return {
    response: response as unknown as Response,
    get statusCode() { return statusCode; },
    get payload() { return payload as Record<string, any>; },
  };
}

test("audit endpoint clamps pagination and parameterizes untrusted search", async () => {
  const { pool, getSuperAdminAuditLogs } = await loadController();
  const queryable = pool as unknown as { query: QueryFunction };
  const originalQuery = queryable.query;
  const calls: Array<{ query: string; values: unknown[] }> = [];

  queryable.query = async (query, values = []) => {
    calls.push({ query, values });
    if (query.includes("COUNT(*)")) return { rows: [{ total: 150 }] };
    return { rows: [{ id: "audit-1", action: "LOGIN_FAILED" }] };
  };

  try {
    const res = mockResponse();
    await getSuperAdminAuditLogs(
      {
        query: {
          limit: "999",
          offset: "-1",
          search: "x' OR 1=1 --",
          actorRole: "SUPER_ADMIN",
        },
      } as never,
      res.response
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.data.page.limit, 100);
    assert.equal(res.payload.data.page.offset, 0);
    assert.equal(res.payload.data.page.total, 150);
    assert.equal(res.payload.data.page.hasMore, true);
    assert.equal(calls.length, 2);
    assert.match(calls[0].query, /action ILIKE \$1/);
    assert.doesNotMatch(calls[0].query, /x' OR 1=1/);
    assert.deepEqual(calls[0].values, ["%x' OR 1=1 --%", "SUPER_ADMIN"]);
    assert.deepEqual(calls[1].values, ["%x' OR 1=1 --%", "SUPER_ADMIN", 100, 0]);
  } finally {
    queryable.query = originalQuery;
  }
});

test("audit endpoint returns a safe error when the audit store fails", async () => {
  const { pool, getSuperAdminAuditLogs } = await loadController();
  const queryable = pool as unknown as { query: QueryFunction };
  const originalQuery = queryable.query;
  queryable.query = async () => {
    throw new Error("database details must not leak");
  };

  try {
    const res = mockResponse();
    await getSuperAdminAuditLogs({ query: {} } as never, res.response);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, {
      success: false,
      message: "Audit logs are temporarily unavailable.",
    });
  } finally {
    queryable.query = originalQuery;
  }
});
