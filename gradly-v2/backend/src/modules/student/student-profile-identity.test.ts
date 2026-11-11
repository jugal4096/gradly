import assert from "node:assert/strict";
import test from "node:test";
import { hasConfirmedAcademicIdentityChanged } from "./student-profile-identity";

const existing = {
  academic_profile_confirmed: true,
  institution_id: "institution-1",
  curriculum_id: "curriculum-1",
  student_identifier: "BT24S06F007",
  admission_year: 2024,
  admission_mode_name: "Direct Second Year",
};
const unchanged = {
  institutionId: "institution-1",
  curriculumId: "curriculum-1",
  studentIdentifier: "bt24s06f007",
  admissionYear: 2024,
  admissionModeName: "Direct Second Year",
};

test("confirmed academic identity accepts an unchanged normalized identity", () => {
  assert.equal(hasConfirmedAcademicIdentityChanged(existing, unchanged), false);
});

test("unconfirmed profiles may complete or correct their initial identity", () => {
  assert.equal(hasConfirmedAcademicIdentityChanged({ ...existing, academic_profile_confirmed: false }, {
    ...unchanged, studentIdentifier: "BT24S06F008",
  }), false);
});

test("confirmed enrollment number cannot be changed by a student update", () => {
  assert.equal(hasConfirmedAcademicIdentityChanged(existing, {
    ...unchanged, studentIdentifier: "BT24S06F008",
  }), true);
});

test("confirmed institution, curriculum, admission year and mode are locked", () => {
  assert.equal(hasConfirmedAcademicIdentityChanged(existing, { ...unchanged, institutionId: "institution-2" }), true);
  assert.equal(hasConfirmedAcademicIdentityChanged(existing, { ...unchanged, curriculumId: "curriculum-2" }), true);
  assert.equal(hasConfirmedAcademicIdentityChanged(existing, { ...unchanged, admissionYear: 2025 }), true);
  assert.equal(hasConfirmedAcademicIdentityChanged(existing, { ...unchanged, admissionModeName: "Regular" }), true);
});
