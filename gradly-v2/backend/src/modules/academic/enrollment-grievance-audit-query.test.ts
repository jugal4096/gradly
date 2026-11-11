import assert from "node:assert/strict";
import test from "node:test";
import { buildEnrollmentGrievanceAuditQuery } from "./enrollment-grievance-audit-query";

test("audit history query uses sequential PostgreSQL bind parameters", () => {
  const query = buildEnrollmentGrievanceAuditQuery({
    grievanceId: "grievance-1", reviewerId: "reviewer-1", limit: 25,
  });
  assert.equal(query.whereSql, "WHERE e.grievance_id = $1 AND e.reviewer_id::text = $2");
  assert.equal(query.limitParameter, "$3");
  assert.deepEqual(query.values, ["grievance-1", "reviewer-1", 25]);
});

test("audit history query supports either filter independently", () => {
  const grievance = buildEnrollmentGrievanceAuditQuery({ grievanceId: "g-1" });
  assert.equal(grievance.whereSql, "WHERE e.grievance_id = $1");
  assert.equal(grievance.limitParameter, "$2");
  assert.deepEqual(grievance.values, ["g-1", 50]);

  const reviewer = buildEnrollmentGrievanceAuditQuery({ reviewerId: "r-1" });
  assert.equal(reviewer.whereSql, "WHERE e.reviewer_id::text = $1");
  assert.equal(reviewer.limitParameter, "$2");
  assert.deepEqual(reviewer.values, ["r-1", 50]);
});

test("audit history query defaults and clamps limits safely", () => {
  assert.equal(buildEnrollmentGrievanceAuditQuery({}).values[0], 50);
  assert.equal(buildEnrollmentGrievanceAuditQuery({ limit: 5000 }).values[0], 200);
  assert.equal(buildEnrollmentGrievanceAuditQuery({ limit: -5 }).values[0], 50);
});
