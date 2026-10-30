import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const session = readFileSync(resolve(root, "src/lib/superAdminSession.ts"), "utf8");
const guard = readFileSync(resolve(root, "src/components/RequireSuperAdmin.tsx"), "utf8");

test("Super Admin session verification distinguishes invalid credentials from forbidden access", () => {
  assert.match(session, /response\.status === 401[\s\S]*?clearToken\(\)[\s\S]*?return "invalid"/);
  assert.match(session, /response\.status === 403\) return "forbidden"/);
  assert.doesNotMatch(session, /response\.status === 403[\s\S]{0,100}clearToken\(\)/);
});

test("Super Admin guard routes forbidden sessions separately from invalid sessions", () => {
  assert.match(guard, /state === "invalid"[\s\S]*?\/super-admin\/login/);
  assert.match(guard, /state === "forbidden"[\s\S]*?authorizationRequired: true/);
  assert.match(guard, /state === "unreachable"[\s\S]*?Retry/);
});

test("Super Admin session verification fails closed when API configuration or network is unavailable", () => {
  assert.match(session, /if \(!isApiConfigured\) return "unreachable"/);
  assert.match(session, /catch \{[\s\S]*?return "unreachable"/);
});
