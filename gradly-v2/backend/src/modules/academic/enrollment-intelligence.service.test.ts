import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseEnrollmentNumber, predictSemester } from "./enrollment-intelligence.service";

test("parses only the first seven characters and preserves the suffix", () => {
  const parsed = parseEnrollmentNumber("BE23S06F007");
  assert.equal(parsed.classificationKey, "BE23S06");
  assert.equal(parsed.prefix, "BE");
  assert.equal(parsed.admissionYear, 2023);
  assert.equal(parsed.admissionModeCode, "S");
  assert.equal(parsed.branchCode, "06");
  assert.equal(parsed.suffix, "F007");
});

test("supports configurable century pivot", () => {
  assert.equal(parseEnrollmentNumber("BE99F05XYZ", 70).admissionYear, 1999);
  assert.equal(parseEnrollmentNumber("BE23F05XYZ", 70).admissionYear, 2023);
});

test("rejects malformed enrollment numbers", () => {
  assert.throws(() => parseEnrollmentNumber("BE23S6F007"), /INVALID_ENROLLMENT_NUMBER/);
  assert.throws(() => parseEnrollmentNumber("??23S06F007"), /INVALID_ENROLLMENT_NUMBER/);
});

test("predicts regular BTech semester 7 in the 2026-27 odd session", () => {
  const result = predictSemester({
    admissionYear: 2023, entrySemester: 1, totalSemesters: 8, durationYears: 4,
    academicYearStartMonth: 7, oddSemesterStartMonth: 7, date: new Date("2026-11-08T12:00:00+05:30"),
  });
  assert.equal(result.expectedSemester, 7);
  assert.equal(result.academicYearLabel, "Final Year");
});

test("predicts DSY progression beyond the final semester instead of clamping to semester 8", () => {
  const result = predictSemester({
    admissionYear: 2023, entrySemester: 3, totalSemesters: 8, durationYears: 3,
    academicYearStartMonth: 7, oddSemesterStartMonth: 7, date: new Date("2026-11-08T12:00:00+05:30"),
  });
  assert.equal(result.expectedSemester, null);
  assert.equal(result.expectedDurationEnded, true);
  assert.equal(result.academicYearLabel, null);
});

test("calculates even semester in the January-June period", () => {
  const result = predictSemester({
    admissionYear: 2023, entrySemester: 1, totalSemesters: 8, durationYears: 4,
    academicYearStartMonth: 7, oddSemesterStartMonth: 7, date: new Date("2027-03-01T12:00:00+05:30"),
  });
  assert.equal(result.expectedSemester, 8);
  assert.equal(result.semesterType, "EVEN");
});
