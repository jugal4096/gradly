import { strict as assert } from "node:assert";
import { test } from "node:test";
import { branchIdentityMatches, enrollmentBranchMatches, isAllowedSchemeForEnrollmentPrefix, parseEnrollmentNumber, predictSemester, programmeMatchesEnrollmentPrefix, resolveEnrollmentBranchCode } from "./enrollment-progression";
import { academicStatusForSemester, availableSemesterOptions, resolveCurrentSemesterSelection } from "../../../../src/features/dashboard/academic-setup-state";

const calendar = { academicYearStartMonth: 7, oddSemesterStartMonth: 7, oddSemesterEndMonth: 12 };
const predict = (admissionYear: number, entrySemester: number, date: string, totalSemesters = 8) =>
  predictSemester({ admissionYear, entrySemester, totalSemesters, ...calendar, date: new Date(date) });


test("programme resolution follows enrollment degree prefix rather than stale rule-table patterns", () => {
  assert.equal(programmeMatchesEnrollmentPrefix("BE", "Bachelor of Engineering"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("BE", "Bachelor of Technology"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("BT", "Bachelor of Technology"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("BT", "Bachelor of Engineering"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("MC", "Master of Computer Applications"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("MT", "Master of Technology"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("ME", "Master of Engineering"), true);
});

test("BE and BT prefixes both resolve B.E. and B.Tech institutional programme labels", () => {
  for (const prefix of ["BE", "BT"]) {
    for (const name of ["B.E.", "B.E. Computer Engineering", "Bachelor of Engineering", "B.Tech.", "B.Tech Computer Engineering", "Bachelor of Technology"]) {
      assert.equal(programmeMatchesEnrollmentPrefix(prefix, name), true, `${prefix}: ${name}`);
    }
  }
  assert.equal(programmeMatchesEnrollmentPrefix("BE", "Master of Technology"), false);
  assert.equal(programmeMatchesEnrollmentPrefix("BT", "Master of Computer Applications"), false);
  assert.equal(programmeMatchesEnrollmentPrefix("ME", "Master of Engineering"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("ME", "Master of Technology"), false);
});

test("matches degree abbreviations with punctuation and common programme-name variants", () => {
  for (const name of ["B.E.", "B E", "Bachelor in Engineering", "Engineering - B.E."]) {
    assert.equal(programmeMatchesEnrollmentPrefix("BE", name), true, name);
  }
  for (const name of ["B.Tech.", "B Tech", "Bachelor in Technology", "Technology - B.Tech."]) {
    assert.equal(programmeMatchesEnrollmentPrefix("BT", name), true, name);
  }
  for (const name of ["M.C.A.", "M C A", "Master in Computer Applications"]) {
    assert.equal(programmeMatchesEnrollmentPrefix("MC", name), true, name);
  }
  for (const name of ["M.Tech.", "M Tech", "Master in Technology"]) {
    assert.equal(programmeMatchesEnrollmentPrefix("MT", name), true, name);
  }
  // BE (legacy New CBCS) and BT (NEP) are two enrollment-prefix generations
  // that may share one undergraduate engineering programme record in the directory.
  assert.equal(programmeMatchesEnrollmentPrefix("BE", "Bachelor of Technology"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("BT", "Bachelor of Engineering"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("BE", "Engineering"), true);
  assert.equal(programmeMatchesEnrollmentPrefix("BT", "Undergraduate Engineering"), true);
});

test("DSE admission for the 2026-27 FY cohort starts only after July 2027", () => {
  assert.throws(
    () => parseEnrollmentNumber("BT27S06F007", 70, new Date("2027-06-30T12:00:00+05:30")),
    /DSE_ADMISSION_CYCLE_NOT_STARTED/,
  );
  assert.equal(
    parseEnrollmentNumber("BT27S06F007", 70, new Date("2027-07-01T12:00:00+05:30")).admissionYear,
    2027,
  );
  // Previously issued DSE enrollment numbers remain valid in their own session.
  assert.equal(parseEnrollmentNumber("BT24S06F007", 70, new Date("2026-11-09T12:00:00+05:30")).admissionYear, 2024);
});

test("parses a strict regular BE enrollment number", () => {
  const p = parseEnrollmentNumber("BE22F06F007");
  assert.deepEqual([p.prefix, p.admissionYear, p.admissionModeCode, p.branchCode, p.suffix], ["BE", 2022, "F", "06", "F007"]);
});

test("parses the supplied BE23S06F007 enrollment structure", () => {
  const p = parseEnrollmentNumber("BE23S06F007");
  assert.deepEqual([p.prefix, p.admissionYear, p.admissionModeCode, p.branchCode, p.suffix], ["BE", 2023, "S", "06", "F007"]);
});

test("accepts configured programme prefixes with 11 characters, F at position 8 and a numeric three-digit serial", () => {
  for (const value of ["BE23S06F007", "BT24S02F999", "MC23F01F123", "MT23F01F123", "ME22F09F001"]) {
    assert.equal(parseEnrollmentNumber(value).enrollmentNumber, value);
  }
});

test("normalizes lowercase input and trims outer whitespace without repairing internals", () => {
  assert.equal(parseEnrollmentNumber("  be23s06f007  ").enrollmentNumber, "BE23S06F007");
  assert.throws(() => parseEnrollmentNumber("BE 23S06F007"), /INVALID_ENROLLMENT_LENGTH/);
  assert.throws(() => parseEnrollmentNumber("BE23S06-F007"), /INVALID_ENROLLMENT_LENGTH/);
});

test("rejects incorrect eighth character with a specific validation error", () => {
  for (const value of ["BE23S06A007", "BE23S06X007", "BE23S06@007"]) {
    assert.throws(() => parseEnrollmentNumber(value), /INVALID_EIGHTH_CHARACTER/);
  }
  assert.throws(() => parseEnrollmentNumber("BE23S06007"), /INVALID_ENROLLMENT_LENGTH/);
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
  assert.equal(parseEnrollmentNumber("MC69F05F001", 70, new Date("2070-11-09T12:00:00+05:30")).admissionYear, 2069);
  assert.equal(parseEnrollmentNumber("MC70F05F001", 70, new Date("2070-11-09T12:00:00+05:30")).admissionYear, 1970);
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
  assert.equal(branchIdentityMatches("Electronics and Telecommunication Engineering", "ENTC", "ENTC"), true);
  assert.equal(branchIdentityMatches("Electronics Engineering", "ENTC", "ENTC"), true);
  assert.equal(branchIdentityMatches("Computer Engineering", "Computer Engineering"), true);
  assert.equal(branchIdentityMatches("Electrical Engineering", "ELECT", "ELECT"), true);
  assert.equal(branchIdentityMatches("Mechanical Engineering", "MECH", "MECH"), true);
  assert.equal(branchIdentityMatches("Mechanical Engineering", "Mechanical", "ME"), true);
  assert.equal(branchIdentityMatches("Information Technology", "Electrical Engineering", "EE"), false);
});


test("semester choices respect odd/even calendar and predicted progress", () => {
  assert.deepEqual(availableSemesterOptions(8, 1, 3, "ODD"), [1, 2, 3]);
  assert.deepEqual(availableSemesterOptions(8, 3, 7, "ODD"), [3, 4, 5, 6, 7]);
  assert.deepEqual(availableSemesterOptions(8, 1, 4, "EVEN"), [1, 2, 3, 4]);
  assert.deepEqual(availableSemesterOptions(8, 3, 4, "EVEN"), [3, 4]);
  assert.deepEqual(availableSemesterOptions(8, 3, null, "ODD", true), [3, 4, 5, 6, 7, 8]);
  assert.deepEqual(availableSemesterOptions(8, 1, null, "EVEN", true), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("successful prediction initializes the controlled current-semester value", () => {
  assert.equal(resolveCurrentSemesterSelection(7, 8, false, ""), "7");
  assert.deepEqual(availableSemesterOptions(8), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("manual semester changes survive prediction rerenders", () => {
  assert.equal(resolveCurrentSemesterSelection(7, 8, true, "5"), "5");
  assert.equal(resolveCurrentSemesterSelection(7, 8, true, "5"), "5");
});

test("a new enrollment resets the previous manual selection", () => {
  assert.equal(resolveCurrentSemesterSelection(null, 8, false, "5"), "");
  assert.equal(resolveCurrentSemesterSelection(7, 8, false, ""), "7");
});

test("curriculum changes revalidate a manual semester against the new option range", () => {
  assert.equal(resolveCurrentSemesterSelection(3, 4, true, "5"), "3");
  assert.deepEqual(availableSemesterOptions(4), [1, 2, 3, 4]);
});

test("completed programme is available only as an explicit student selection", () => {
  assert.equal(resolveCurrentSemesterSelection(null, 8, false, ""), "");
  assert.equal(resolveCurrentSemesterSelection(8, 8, true, "COMPLETED"), "COMPLETED");
  assert.equal(academicStatusForSemester("COMPLETED"), "GRADUATED");
  assert.equal(academicStatusForSemester("7"), "ENROLLED");
});


test("BE is restricted to NEW CBCS and BT is restricted to NEP", () => {
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BE", "New CBCS"), true);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BE", "New CBCS 2023"), true);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BE", "New CBCS NEP"), false);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BE", "Legacy CBCS"), false);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BT", "New CBCS"), false);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BT", "Legacy CBCS"), false);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BT", "NEP"), true);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BT", "NEP 2020"), true);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BT", "NEP Legacy CBCS"), false);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BT", "New Education Policy"), true);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BT", "National Education Policy (NEP) 2020"), true);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("BT", null), false);
});

test("MC retains its configured scheme while ME is New CBCS and MT is NEP", () => {
  assert.equal(isAllowedSchemeForEnrollmentPrefix("MC", "MCA 2023"), true);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("ME", "New CBCS"), true);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("ME", "NEP"), false);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("MT", "NEP 2023"), true);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("MT", "New CBCS"), false);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("MC", ""), false);
  assert.equal(isAllowedSchemeForEnrollmentPrefix("MT", null), false);
});


test("BE23S direct-second-year progression reaches semester 7 in the 2025-26 odd session", () => {
  assert.equal(predict(2023, 3, "2025-11-09T12:00:00+05:30").expectedSemester, 7);
});

test("BT24S06F007 direct-second-year enrollment predicts semester 7 in the 2026-27 odd session", () => {
  const parsed = parseEnrollmentNumber("BT24S06F007");
  assert.deepEqual([parsed.prefix, parsed.admissionYear, parsed.admissionModeCode, parsed.branchCode], ["BT", 2024, "S", "06"]);
  assert.equal(predict(parsed.admissionYear, 3, "2026-11-09T12:00:00+05:30").expectedSemester, 7);
});


test("GECA branch codes are decoded deterministically without enrollment_branch_codes lookups", () => {
  const institution = "Government College of Engineering, Aurangabad";
  const expected: Record<string, string> = {
    "01": "Civil Engineering",
    "02": "Mechanical Engineering",
    "03": "Electrical Engineering",
    "04": "Electronics and Telecommunication Engineering",
    "05": "Computer Science and Engineering",
    "06": "Information Technology",
  };
  for (const [code, branch] of Object.entries(expected)) {
    assert.equal(resolveEnrollmentBranchCode(institution, "BT", code), branch);
    assert.equal(resolveEnrollmentBranchCode(institution, "BE", code), branch);
  }
  assert.equal(resolveEnrollmentBranchCode(institution, "BT", "07"), null);
  assert.equal(resolveEnrollmentBranchCode("Other University", "BT", "06"), null);
});

test("ME is regular-only New CBCS through 2022; MT is regular-only NEP from 2023", () => {
  assert.equal(parseEnrollmentNumber("ME22F09F001", 70, new Date("2026-11-09T12:00:00+05:30")).admissionYear, 2022);
  assert.throws(() => parseEnrollmentNumber("ME22S09F001", 70, new Date("2026-11-09T12:00:00+05:30")), /POSTGRADUATE_REGULAR_ADMISSION_ONLY/);
  assert.throws(() => parseEnrollmentNumber("ME23F09F001", 70, new Date("2026-11-09T12:00:00+05:30")), /ME_CBCS_DISCONTINUED/);
  assert.throws(() => parseEnrollmentNumber("ME24F09F001", 70, new Date("2026-11-09T12:00:00+05:30")), /ME_CBCS_DISCONTINUED/);
  assert.throws(() => parseEnrollmentNumber("MT22F09F001", 70, new Date("2026-11-09T12:00:00+05:30")), /MT_NEP_NOT_STARTED/);
  assert.equal(parseEnrollmentNumber("MT23F09F001", 70, new Date("2026-11-09T12:00:00+05:30")).admissionYear, 2023);
  assert.throws(() => parseEnrollmentNumber("MT23S09F001", 70, new Date("2026-11-09T12:00:00+05:30")), /POSTGRADUATE_REGULAR_ADMISSION_ONLY/);
});

test("GECA M.Tech specialization codes resolve through their stored department branches", () => {
  assert.equal(enrollmentBranchMatches("MT", "Structural Engineering", {
    name: "APPLIED MECHANICS", code: "APPLIED_MECHANICS",
    specializationName: "Structural Engineering", specializationCode: "STRUCTURAL",
  }), true);
  assert.equal(enrollmentBranchMatches("MT", "Water Resources Engineering", {
    name: "CIVIL", code: "CIVIL",
    specializationName: "Water Resources Engineering", specializationCode: "WRE",
  }), true);
  assert.equal(enrollmentBranchMatches("MT", "Electrical Machines and Drives", {
    name: "ELECTRICAL", code: "ELECTRICAL",
    specializationName: "Electrical Power Systems", specializationCode: "EPS",
  }), false);
  assert.equal(enrollmentBranchMatches("MT", "Computer Science and Engineering", {
    name: "Computer Science and Engineering", code: "CSE",
  }), false);
  // Electronics Engineering must not also match Electronics & Telecommunication.
  assert.equal(enrollmentBranchMatches("MT", "Electronics Engineering", {
    name: "ELECTRONICS", code: "ELECTRONICS",
    specializationName: "Electronics and Telecommunication Engineering", specializationCode: "ENTC",
  }), false);
});

test("GECA MT specialization codes use only the supplied mappings", () => {
  const institution = "Government College of Engineering, Aurangabad";
  const expected: Record<string, string> = {
    "09": "Structural Engineering", "08": "Water Resources Engineering", "16": "Geotechnical Engineering",
    "15": "Electrical Machines and Drives", "12": "Electrical Power Systems",
    "13": "Electronics and Telecommunication Engineering", "05": "Computer Science and Engineering",
  };
  for (const [code, branch] of Object.entries(expected)) assert.equal(resolveEnrollmentBranchCode(institution, "MT", code), branch);
  const geotechnical = parseEnrollmentNumber("MT25F16F008", 70, new Date("2026-11-09T12:00:00+05:30"));
  assert.deepEqual([geotechnical.prefix, geotechnical.admissionYear, geotechnical.admissionModeCode, geotechnical.branchCode], ["MT", 2025, "F", "16"]);
  assert.equal(resolveEnrollmentBranchCode(institution, geotechnical.prefix, geotechnical.branchCode), "Geotechnical Engineering");
  assert.equal(resolveEnrollmentBranchCode(institution, "MT", "99"), null);
  assert.equal(resolveEnrollmentBranchCode(institution, "ME", "09"), null);
});

test("BE23S remains valid while BE23F and BE24 are rejected after CBCS discontinuation", () => {
  const inNovember2027 = new Date("2027-11-09T12:00:00+05:30");
  assert.equal(parseEnrollmentNumber("BE23S06F007", 70, inNovember2027).admissionYear, 2023);
  assert.throws(() => parseEnrollmentNumber("BE23F06F007", 70, inNovember2027), /BE23_FIRST_YEAR_NOT_ALLOWED/);
  assert.throws(() => parseEnrollmentNumber("BE24S06F007", 70, inNovember2027), /BE_CBCS_DISCONTINUED/);
  assert.equal(parseEnrollmentNumber("BE22F06F007", 70, inNovember2027).admissionYear, 2022);
});

test("BT enrollment years cannot precede NEP or enter before their July academic session", () => {
  assert.throws(() => parseEnrollmentNumber("BT22S06F007", 70, new Date("2027-11-09T12:00:00+05:30")), /BT_NEP_NOT_STARTED/);
  assert.equal(parseEnrollmentNumber("BT27S06F007", 70, new Date("2027-11-09T12:00:00+05:30")).admissionYear, 2027);
  assert.throws(() => parseEnrollmentNumber("BT28S06F007", 70, new Date("2028-06-30T12:00:00+05:30")), /FUTURE_ADMISSION_YEAR/);
  assert.equal(parseEnrollmentNumber("BT28S06F007", 70, new Date("2028-07-01T12:00:00+05:30")).admissionYear, 2028);
});

test("M.Tech enrollment identity never resolves from department-only records without specialization", () => {
  // The institution stores Structural Engineering under the Applied Mechanics
  // department, and Water Resources / Geotechnical under Civil. Some curriculum
  // records are department-level and therefore have no specialization row.
  assert.equal(enrollmentBranchMatches("MT", "Structural Engineering", {
    name: "APPLIED MECHANICS", code: "APPLIED_MECHANICS",
  }), false);
  assert.equal(enrollmentBranchMatches("MT", "Water Resources Engineering", {
    name: "CIVIL", code: "CIVIL",
  }), false);
  assert.equal(enrollmentBranchMatches("MT", "Geotechnical Engineering", {
    name: "CIVIL", code: "CIVIL",
  }), false);
  assert.equal(enrollmentBranchMatches("MT", "Structural Engineering", {
    name: "CIVIL", code: "CIVIL",
  }), false);
  assert.equal(enrollmentBranchMatches("MT", "Water Resources Engineering", {
    name: "APPLIED MECHANICS", code: "APPLIED_MECHANICS",
  }), false);
  assert.equal(enrollmentBranchMatches("MT", "Computer Science and Engineering", {
    name: "Computer Science and Engineering", code: "CSE",
  }), false);
});
