import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
const migration = read("../../../migrations/20261110_to09_reviewer_accountability_audit_history.sql");
const controller = read("./student-enrollment-grievance.controller.ts");
const routes = read("../super-admin/superAdmin.routes.ts");
const repository = read("./student.repository.ts");
const studentController = read("./student.controller.ts");

test("TO-09 migration stores reviewer, academic scope, decision and before/after snapshots", () => {
  for (const column of [
    "reviewer_id", "reviewer_role", "institution_id", "programme_scope", "branch_scope",
    "event_type", "previous_status", "new_status", "old_values", "new_values", "decision_reason",
    "information_request", "created_at",
  ]) assert.match(migration, new RegExp("\\b" + column + "\\b"));
});

test("TO-09 audit history is protected against UPDATE and DELETE", () => {
  assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.student_enrollment_grievance_events/);
  assert.match(migration, /Enrollment grievance decision history is append-only/);
});

test("review decisions lock the open grievance and commit decision plus audit event atomically", () => {
  assert.match(controller, /BEGIN/);
  assert.match(controller, /FOR UPDATE OF g/);
  assert.match(controller, /g\.status IN \('PENDING','IN_REVIEW','NEEDS_INFO'\)/);
  assert.match(controller, /INSERT INTO public\.student_enrollment_grievance_events/);
  assert.match(controller, /COMMIT/);
  assert.match(controller, /ROLLBACK/);
});

test("reviewer history endpoint is Super Admin authenticated", () => {
  assert.match(routes, /router\.get\("\/enrollment-grievance-audit-history", authenticateSuperAdminToken, listEnrollmentGrievanceAuditHistory\)/);
});

test("confirmed identity is checked by controller and atomically guarded by repository", () => {
  assert.match(studentController, /hasConfirmedAcademicIdentityChanged\(existingProfile, payload\)/);
  assert.match(studentController, /ACADEMIC_IDENTITY_LOCKED/);
  assert.match(repository, /student_profiles\.academic_profile_confirmed IS NOT TRUE/);
  assert.match(repository, /student_profiles\.academic_profile_confirmed OR \$12/);
  assert.match(repository, /WHEN student_profiles\.academic_profile_confirmed IS TRUE THEN student_profiles\.academic_profile_overrides/);
});

test("student grievance and institution-request reads are scoped to the authenticated student", () => {
  assert.match(controller, /WHERE student_user_id = \$1 ORDER BY created_at DESC LIMIT 100/);
  const institutionController = read("./student-institution.controller.ts");
  assert.match(institutionController, /WHERE requested_by_user_id = \$1/);
  assert.match(institutionController, /requested_by_user_id\)/);
});

test("institution Admin grievance access is restricted to the assigned institution", () => {
  assert.match(controller, /const institutionId = req\.admin\?\.institutionId/);
  assert.match(controller, /WHERE g\.institution_id = \$1/);
  const adminRoutes = read("../admin/admin.routes.ts");
  assert.match(adminRoutes, /router\.get\("\/enrollment-grievances", authenticateAdminToken, listEnrollmentGrievancesForAdmin\)/);
  assert.doesNotMatch(adminRoutes, /router\.patch\("\/enrollment-grievances/);
});

test("student routes require Firebase authentication before onboarding and grievance handlers", () => {
  const studentRoutes = read("./student.routes.ts");
  assert.match(studentRoutes, /router\.use\(authenticateFirebaseToken\)/);
  assert.match(studentRoutes, /router\.post\("\/institution-requests", requestStudentInstitution\)/);
  assert.match(studentRoutes, /router\.post\("\/enrollment-grievances", submitEnrollmentGrievance\)/);
});

test("grievance event writes match the immutable TO-09 audit table schema", () => {
  for (const column of ["reviewer_id", "reviewer_role", "institution_id", "previous_status", "new_status", "decision_reason"]) {
    assert.match(migration, new RegExp("\\b" + column + "\\b"));
    assert.match(controller, new RegExp("\\b" + column + "\\b"));
  }
  assert.doesNotMatch(controller, /student_enrollment_grievance_events[^\n]*(actor_type|actor_user_id|from_status|to_status|\bnote\b)/);
  assert.match(controller, /event_type[^\n]*'DECISION_RECORDED'/);
});
