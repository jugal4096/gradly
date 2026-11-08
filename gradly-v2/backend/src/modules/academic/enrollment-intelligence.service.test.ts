import { strict as assert } from "node:assert";
import { test } from "node:test";
import { branchIdentityMatches, parseEnrollmentNumber, predictSemester } from "./enrollment-progression";

const calendar = { academicYearStartMonth: 7, oddSemesterStartMonth: 7, oddSemesterEndMonth: 12 };
const predict = (admissionYear: number, entrySemester: number, date: string, totalSemesters = 8) =>
  predictSemester({ admissionYear, entrySemester, totalSemesters, ...calendar, date: new Date(date) });

test("parses a strict regular BE enrollment number", () => {
  const p = parseEnrollmentNumber("BE23F06F007");
  assert.deepEqual([p.prefix, p.admissionYear, p.admissionModeCode, p.branchCode, p.suffix], ["BE", 2023, "F", "06", "F007"]);
});

test("parses the supplied BE23S06F007 enrollment structure", () => {
  const p = parseEnrollmentNumber("BE23S06F007");
  assert.deepEqual([p.prefix, p.admissionYear, p.admissionModeCode, p.branchCode, p.suffix], ["BE", 2023, "S", "06", "F007"]);
});

test("accepts configured programme prefixes with strict format", () => {
  for (const value of ["BE23S06F007", "BT24S02F999", "MC23F01F123", "MT23F01F123"]) {
    assert.equal(parseEnrollmentNumber(value).enrollmentNumber, value);
  }
});

test("normalizes lowercase input and trims outer whitespace without repairing internals", () => {
  assert.equal(parseEnrollmentNumber("  be23s06f007  ").enrollmentNumber, "BE23S06F007");
  assert.throws(() => parseEnrollmentNumber("BE 23S06F007"), /INVALID_EIGHTH_CHARACTER/);
  assert.throws(() => parseEnrollmentNumber("BE23S06-F007"), /INVALID_EIGHTH_CHARACTER/);
});

test("rejects incorrect eighth character with a specific validation error", () => {
  for (const value of ["BE23S06007", "BE23S06A007", "BE23S06X007", "BE23S06@007"]) {
    assert.throws(() => parseEnrollmentNumber(value), /INVALID_EIGHTH_CHARACTER/);
  }
});

test("rejects non-numeric final three characters", () => {
  for (const value of ["BE23S06F00A", "BE23S06F0@7", "BE23S06FABC"]) {
    assert.throws(() => parseEnrollmentNumber(value), /INVALID_STUDENT_SERIAL/);
  }
});

test("rejects invalid programme, year, mode, branch structure and length", () => {
  const cases: Array<[string, RegExp]> = [
    ["XX23S06F007", /INVALID_PROGRAMME_PREFIX/],
    ["BE2AS06F007", /INVALID_ADMISSION_YEAR/],
    ["BE23X06F007", /INVALID_ADMISSION_MODE/],
    ["BE23S0AF007", /INVALID_BRANCH_CODE/],
    ["BE23S06F07", /INVALID_ENROLLMENT_LENGTH/],
    ["BE23S06F0007", /INVALID_ENROLLMENT_LENGTH/],
    ["", /EMPTY_ENROLLMENT_NUMBER/],
  ];
  for (const [value, error] of cases) assert.throws(() => parseEnrollmentNumber(value), error);
});

test("uses configurable century boundary", () => {
  assert.equal(parseEnrollmentNumber("BE69F05F001", 70).admissionYear, 2069);
  assert.equal(parseEnrollmentNumber("BE70F05F001", 70).admissionYear, 1970);
});

test("BE23S06F007 in November 2026 has completed expected DSY programme duration", () => {
  const p = predict(2023, 3, "2026-11-08T12:00:00+05:30");
  assert.equal(p.expectedSemester, null);
  assert.equal(p.expectedDurationEnded, true);
  assert.equal(p.academicYear, "2026-27");
});

test("BE23F06F007 in November 2026 is expected in semester 7", () => {
  const p = predict(2023, 1, "2026-11-08T12:00:00+05:30");
  assert.equal(p.expectedSemester, 7);
  assert.equal(p.expectedDurationEnded, false);
});

test("BE24S06F007 in November 2026 is expected in semester 7", () => {
  const p = predict(2024, 3, "2026-11-08T12:00:00+05:30");
  assert.equal(p.expectedSemester, 7);
});

test("BE24F06F007 in November 2026 is expected in semester 5", () => {
  assert.equal(predict(2024, 1, "2026-11-08T12:00:00+05:30").expectedSemester, 5);
});

test("January-June maps to even semester and July-December to odd", () => {
  assert.equal(predict(2023, 1, "2027-03-01T12:00:00+05:30").expectedSemester, 8);
  assert.equal(predict(2023, 1, "2026-09-01T12:00:00+05:30").expectedSemester, 7);
});

test("completed programme has no active expected semester", () => {
  const p = predict(2023, 3, "2027-03-01T12:00:00+05:30");
  assert.equal(p.expectedSemester, null);
  assert.equal(p.expectedDurationEnded, true);
});

test("supports a four-semester postgraduate programme", () => {
  const p = predictSemester({ admissionYear: 2025, entrySemester: 1, totalSemesters: 4, academicYearStartMonth: 7, oddSemesterStartMonth: 7, oddSemesterEndMonth: 12, date: new Date("2026-11-08T12:00:00+05:30") });
  assert.equal(p.expectedSemester, 3);
});

test("supports a configured September academic session start", () => {
  const p = predictSemester({ admissionYear: 2023, entrySemester: 1, totalSemesters: 8, academicYearStartMonth: 9, oddSemesterStartMonth: 9, oddSemesterEndMonth: 2, date: new Date("2026-11-08T12:00:00+05:30") });
  assert.equal(p.academicYear, "2026-27");
  assert.equal(p.semesterType, "ODD");
});

test("matches common branch labels and abbreviations", () => {
  assert.equal(branchIdentityMatches("Electrical Engineering", "ELECTR", "ELECTR"), true);
  assert.equal(branchIdentityMatches("Electrical Engineering", "EE", "EE"), true);
  assert.equal(branchIdentityMatches("Information Technology", "IT"), true);
  assert.equal(branchIdentityMatches("Computer Science and Engineering", "CSE"), true);
  assert.equal(branchIdentityMatches("Electronics and Telecommunication Engineering", "E&TC"), true);
  assert.equal(branchIdentityMatches("Mechanical Engineering", "Mechanical", "ME"), true);
  assert.equal(branchIdentityMatches("Information Technology", "Electrical Engineering", "EE"), false);
});
