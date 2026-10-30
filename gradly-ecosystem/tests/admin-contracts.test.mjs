import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ecosystemRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(ecosystemRoot, "..");

function read(root, path) {
  return readFileSync(resolve(root, path), "utf8");
}

const adminApply = read(ecosystemRoot, "src/pages/admin/AdminApply.tsx");
const adminRegister = read(ecosystemRoot, "src/pages/admin/AdminRegister.tsx");
const superAdminApplications = read(ecosystemRoot, "src/pages/super-admin/SuperAdminApplications.tsx");
const superAdminAdministrators = read(ecosystemRoot, "src/pages/super-admin/SuperAdminAdministrators.tsx");
const superAdminUsers = read(ecosystemRoot, "src/pages/super-admin/SuperAdminUsers.tsx");
const superAdminDashboard = read(ecosystemRoot, "src/pages/super-admin/SuperAdminDashboard.tsx");
const session = read(ecosystemRoot, "src/lib/superAdminSession.ts");
const userManagementRoutes = read(repositoryRoot, "gradly-v2/backend/src/modules/super-admin/user-management.routes.ts");
const userManagementController = read(repositoryRoot, "gradly-v2/backend/src/modules/super-admin/user-management.controller.ts");
const adminApplicationRoutes = read(repositoryRoot, "gradly-v2/backend/src/modules/admin-application/admin-application.routes.ts");
const adminApplicationService = read(repositoryRoot, "gradly-v2/backend/src/modules/admin-application/admin-application.service.ts");
const academicRoutes = read(repositoryRoot, "gradly-v2/backend/src/modules/academic/academic.routes.ts");
const superAdminApplicationRoutes = read(repositoryRoot, "gradly-v2/backend/src/modules/super-admin/admin-application.routes.ts");
const superAdminApplicationController = read(repositoryRoot, "gradly-v2/backend/src/modules/super-admin/admin-application.controller.ts");
const administratorRoutes = read(repositoryRoot, "gradly-v2/backend/src/modules/administrator/administrator.routes.ts");
const administratorController = read(repositoryRoot, "gradly-v2/backend/src/modules/administrator/administrator.controller.ts");
const registrationRoutes = read(repositoryRoot, "gradly-v2/backend/src/modules/admin-registration/admin-registration.routes.ts");
const registrationService = read(repositoryRoot, "gradly-v2/backend/src/modules/admin-registration/admin-registration.service.ts");
const dashboardController = read(repositoryRoot, "gradly-v2/backend/src/modules/super-admin/superAdmin-dashboard.controller.ts");
const appEntrypoint = read(repositoryRoot, "gradly-v2/backend/src/app.ts");

test("applicant institution selector matches public academic master-data contract", () => {
  assert.match(adminApply, /fetch\(\`\$\{API_BASE_URL\}\/api\/academic\/institutions\`/);
  assert.match(academicRoutes, /router\.get\([\s\S]*?["']\/institutions["'][\s\S]*?res\.status\(200\)\.json\(\{\s*success: true,\s*data: institutions/s);
  assert.match(academicRoutes, /Authentication is intentionally NOT required/);
  assert.match(adminApply, /Array\.isArray\(result\?\.data\)/);
});

test("applicant submission and ownership-scoped status retrieval match backend routes", () => {
  assert.match(appEntrypoint, /app\.use\(["']\/api\/admin-applications["'],\s*adminApplicationRoutes\)/);
  assert.match(adminApplicationRoutes, /router\.post\([\s\S]*?["']\/["'][\s\S]*?authenticateFirebaseToken[\s\S]*?submitApplication/s);
  assert.match(adminApplicationRoutes, /router\.get\([\s\S]*?["']\/mine["'][\s\S]*?authenticateFirebaseToken[\s\S]*?getMyApplications/s);
  assert.match(adminApply, /fetch\(\`\$\{API_BASE_URL\}\/api\/admin-applications\`/);
  assert.match(adminApply, /fetch\(\`\$\{API_BASE_URL\}\/api\/admin-applications\/mine\`/);
  for (const field of ["institution_id", "branch_id", "full_name", "enrollment_number", "mobile_number", "graduation_date", "qualification", "reason", "additional_note"]) {
    assert.match(adminApply, new RegExp(field + "\\s*:"));
  }
  assert.match(adminApplicationService, /findApplicationsForUser\(user\.id\)/);
});

test("administrator registration consumes and authorizes the exact accepted application ID", () => {
  assert.match(registrationRoutes, /router\.post\([\s\S]*?authenticateFirebaseToken[\s\S]*?completeAdminRegistration/s);
  assert.match(adminRegister, /application_id:\s*applicationId/);
  assert.match(registrationService, /validateApplicationId\(body\.application_id\)/);
  assert.match(registrationService, /WHERE id = \$1\s+AND user_id = \$2\s+AND status = 'ACCEPTED'/);
  assert.match(registrationService, /\[applicationId, user\.id\]/);
  assert.match(registrationService, /application has already been registered/i);
});

test("Super Admin application-review UI uses actual route/status/payload contracts", () => {
  assert.match(appEntrypoint, /app\.use\([\s\S]*?["']\/api\/super-admin\/applications["'],\s*superAdminApplicationRoutes/s);
  assert.match(superAdminApplicationRoutes, /router\.get\([\s\S]*?["']\/["'][\s\S]*?applicationsHandler/s);
  assert.match(superAdminApplicationRoutes, /router\.patch\([\s\S]*?["']\/:applicationId\/configuration["'][\s\S]*?configurationHandler/s);
  assert.match(superAdminApplicationRoutes, /router\.patch\([\s\S]*?["']\/:applicationId\/review["'][\s\S]*?reviewHandler/s);
  assert.match(superAdminApplications, /status === "ALL"\s*\?\s*""/);
  assert.match(superAdminApplicationController, /rawStatus !== "PENDING"[\s\S]*?rawStatus !== "ACCEPTED"[\s\S]*?rawStatus !== "REJECTED"/);
  assert.match(superAdminApplications, /branchId:\s*departmentId,\s*approvedPermissions/);
  assert.match(superAdminApplications, /decision,\s*branchId:\s*departmentId,\s*permissions:\s*approvedPermissions/);
  assert.match(superAdminApplications, /decision,\s*rejection_reason:\s*reason\.trim\(\)/);
  assert.doesNotMatch(superAdminApplications, /performAction\(["']block["']\)/);
});

test("administrator list and status mutation use the existing protected API", () => {
  assert.match(appEntrypoint, /app\.use\([\s\S]*?["']\/api\/super-admin\/administrators["'],\s*administratorRoutes/s);
  assert.match(administratorRoutes, /router\.get\([\s\S]*?getAdministrators/s);
  assert.match(administratorRoutes, /router\.patch\([\s\S]*?["']\/:adminId\/status["'][\s\S]*?updateAdministratorStatus/s);
  assert.match(administratorController, /status !== "ACTIVE"[\s\S]*?status !== "SUSPENDED"[\s\S]*?status !== "DISABLED"/);
  assert.match(superAdminAdministrators, /\/api\/super-admin\/administrators\$\{queryString/);
  assert.match(superAdminAdministrators, /\/status/);
  assert.match(superAdminAdministrators, /JSON\.stringify\(\{ status: nextStatus \}\)/);
  assert.match(superAdminAdministrators, /window\.confirm/);
});


test("user list search matches supported Super Admin user endpoint", () => {
  assert.match(userManagementRoutes, /router\.get\([\s\S]*?["']\/["'][\s\S]*?listStudents/s);
  assert.match(userManagementController, /typeof req\.query\.search === "string"/);
  assert.match(userManagementController, /count:\s*students\.length/);
  assert.match(superAdminUsers, /params\.set\("search", query\.trim\(\)\)/);
  assert.match(superAdminUsers, /\/api\/super-admin\/users\?\$\{params\.toString\(\)\}/);
});

test("session verification preserves token on forbidden and transient responses", () => {
  assert.match(session, /if \(response\.status === 401\)\s*\{\s*clearToken\(\);\s*return "invalid";/);
  assert.match(session, /if \(response\.status === 403\) return "forbidden"/);
  assert.doesNotMatch(session, /status === 401 \|\| response\.status === 403/);
  assert.match(session, /catch\s*\{\s*return "unreachable";/);
});

test("dashboard does not fabricate platform-wide user totals or show healthy counts on failed fetches", () => {
  assert.match(dashboardController, /SELECT COUNT\(\*\) FROM users[\s\S]*?AS "totalUsers"/);
  assert.match(superAdminDashboard, /totalUsers:\s*nullableCount\(data\.totalUsers\)/);
  assert.match(superAdminDashboard, /function formatCount\(value: number \| null\): string \{\s*return value === null \? "—" : formatNumber\(value\);/);\n  assert.match(superAdminDashboard, /formatCount\(value\)/);
  assert.match(superAdminDashboard, /loading \|\| error \? "—"/);
  assert.match(superAdminDashboard, /error \? "—" : `\$\{activities\.length\} EVENTS`/);
});
