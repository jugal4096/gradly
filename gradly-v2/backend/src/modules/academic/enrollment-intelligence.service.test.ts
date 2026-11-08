import { strict as assert } from "node:assert";
import { test } from "node:test";
import { branchIdentityMatches, parseEnrollmentNumber, predictSemester } from "./enrollment-progression";

const calendar = { academicYearStartMonth: 7, oddSemesterStartMonth: 7, oddSemesterEndMonth: 12 };
const predict = (admissionYear: number, entrySemester: number, date: string, totalSemesters = 8) =>
  predictSemester({ admissionYear, entrySemester, totalSemesters, ...calendar, date: new Date(date) });

test("BE23S06F007 resolves its first seven characters and preserves the suffix", () => {
  const p = parseEnrollmentNumber("BE23S06F007");
  assert.deepEqual(
    [p.prefix, p.admissionYear, p.admissionModeCode, p.branchCode, p.classificationKey, p.suffix],
    ["BE", 2023, "S", "06", "BE23S06", "F007"],
  );
});

test("parses regular BTech enrollment and IT branch code", () => {
  const p = parseEnrollmentNumber("BE23F06007");
  assert.equal(p.prefix, "BE");
  assert.equal(p.admissionYear, 2023);
  assert.equal(p.admissionModeCode, "F");
  assert.equal(p.branchCode, "06");
});

test("parses 2024 DSY enrollment", () => {
  const p = parseEnrollmentNumber("BE24S06007");
  assert.equal(p.admissionYear, 2024);
  assert.equal(p.admissionModeCode, "S");
  assert.equal(p.branchCode, "06");
});

test("parses 2024 regular enrollment", () => {
  const p = parseEnrollmentNumber("BE24F06007");
  assert.equal(p.admissionYear, 2024);
  assert.equal(p.admissionModeCode, "F");
  assert.equal(p.branchCode, "06");
});

test("uses configurable century boundary", () => {
  assert.equal(parseEnrollmentNumber("BE69F05001", 70).admissionYear, 2069);
  assert.equal(parseEnrollmentNumber("BE70F05001", 70).admissionYear, 1970);
});

test("rejects malformed enrollment numbers", () => {
  for (const value of ["", "BE23S6F007", "??23S06F007", "BE2XS06F007", "BE23S06"]) {
    assert.throws(() => parseEnrollmentNumber(value), /INVALID_ENROLLMENT_NUMBER/);
  }
});

test("BE23S06F007 in November 2026 has completed expected DSY programme duration", () => {
  const p = predict(2023, 3, "2026-11-08T12:00:00+05:30");
  assert.equal(p.expectedSemester, null);
  assert.equal(p.expectedDurationEnded, true);
  assert.equal(p.academicYear, "2026-27");
});

test("BE23F06007 in November 2026 is expected in semester 7", () => {
  const p = predict(2023, 1, "2026-11-08T12:00:00+05:30");
  assert.equal(p.expectedSemester, 7);
  assert.equal(p.expectedDurationEnded, false);
});

test("BE24S06007 in November 2026 follows the same DSY rule and is expected in semester 7", () => {
  const p = predict(2024, 3, "2026-11-08T12:00:00+05:30");
  assert.equal(p.expectedSemester, 7);
  assert.equal(p.expectedDurationEnded, false);
});

test("BE24F06007 in November 2026 is expected in semester 5", () => {
  const p = predict(2024, 1, "2026-11-08T12:00:00+05:30");
  assert.equal(p.expectedSemester, 5);
});

test("January-June maps to the even semester and July-December to odd", () => {
  assert.equal(predict(2023, 1, "2027-03-01T12:00:00+05:30").expectedSemester, 8);
  assert.equal(predict(2023, 1, "2026-09-01T12:00:00+05:30").expectedSemester, 7);
});

test("completed programme never clamps expected semester to the final semester", () => {
  const p = predict(2023, 3, "2027-03-01T12:00:00+05:30");
  assert.equal(p.expectedSemester, null);
  assert.equal(p.expectedDurationEnded, true);
});

test("supports a four-semester postgraduate programme", () => {
  const p = predictSemester({
    admissionYear: 2025, entrySemester: 1, totalSemesters: 4,
    academicYearStartMonth: 7, oddSemesterStartMonth: 7, oddSemesterEndMonth: 12,
    date: new Date("2026-11-08T12:00:00+05:30"),
  });
  assert.equal(p.expectedSemester, 3);
});

test("supports delayed academic session start configured for September", () => {
  const p = predictSemester({
    admissionYear: 2023, entrySemester: 1, totalSemesters: 8,
    academicYearStartMonth: 9, oddSemesterStartMonth: 9, oddSemesterEndMonth: 2,
    date: new Date("2026-11-08T12:00:00+05:30"),
  });
  assert.equal(p.academicYear, "2026-27");
  assert.equal(p.semesterType, "ODD");
});

test("matches configured branch names despite common academic naming differences", () => {
  assert.equal(branchIdentityMatches("Information Technology", "IT"), true);
  assert.equal(branchIdentityMatches("Information Technology", "Information Technology Engineering"), true);
  assert.equal(branchIdentityMatches("Computer Science and Engineering", "CSE"), true);
  assert.equal(branchIdentityMatches("Electronics and Telecommunication Engineering", "E&TC"), true);
});

test("uses branch directory code as an additional branch identity", () => {
  assert.equal(branchIdentityMatches("Information Technology", "Department of IT", "IT"), true);
  assert.equal(branchIdentityMatches("Mechanical Engineering", "Mechanical", "ME"), true);
});

test("does not match unrelated branch labels by loose substring", () => {
  assert.equal(branchIdentityMatches("Information Technology", "Electrical Engineering", "EE"), false);
  assert.equal(branchIdentityMatches("Computer Science and Engineering", "Computer Engineering", "CE"), false);
  assert.equal(branchIdentityMatches("Information Technology", "IT and Computer Science", null), false);
});