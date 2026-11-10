function academicSessionStartYear(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  return month >= 7 ? year : year - 1;
}

/** Enforces scheme-era and academic-session admission-year boundaries. */
export function validateEnrollmentYear(
  prefix: string,
  admissionYear: number,
  admissionModeCode: string,
  now: Date = new Date(),
): void {
  const latestStartedAdmissionYear = academicSessionStartYear(now);
  // A direct-second-year (DSE/DSY) intake for session Y cannot begin until
  // the FY cohort for Y-1 has completed its first year and the Y session starts.
  // With a July session boundary, 2026-27 FY entrants become eligible for the
  // corresponding DSE intake only from July 2027 (enrollment year 2027).
  if (prefix === "BT" && admissionModeCode === "S" && admissionYear > latestStartedAdmissionYear) {
    throw new Error("DSE_ADMISSION_CYCLE_NOT_STARTED");
  }
  if (admissionYear > latestStartedAdmissionYear) {
    throw new Error("FUTURE_ADMISSION_YEAR");
  }
  if (prefix === "BE") {
    if (admissionYear > 2023) throw new Error("BE_CBCS_DISCONTINUED");
    if (admissionYear === 2023 && admissionModeCode !== "S") {
      throw new Error("BE23_FIRST_YEAR_NOT_ALLOWED");
    }
  }
  if (prefix === "BT" && admissionYear < 2023) {
    throw new Error("BT_NEP_NOT_STARTED");
  }
  // ME is legacy New CBCS; MT is post-2023 NEP. Both are regular first-year only.
  if ((prefix === "ME" || prefix === "MT") && admissionModeCode !== "F") throw new Error("POSTGRADUATE_REGULAR_ADMISSION_ONLY");
  if (prefix === "ME" && admissionYear >= 2023) throw new Error("ME_CBCS_DISCONTINUED");
  if (prefix === "MT" && admissionYear < 2023) throw new Error("MT_NEP_NOT_STARTED");
}

export type EnrollmentComponents = {
  enrollmentNumber: string; classificationKey: string; prefix: string; admissionYear: number;
  admissionModeCode: string; branchCode: string; suffix: string;
};

export function parseEnrollmentNumber(input: string, pivotStart = 70, now: Date = new Date()): EnrollmentComponents {
  // Normalize case and outer whitespace only. Never repair or remove internal characters.
  const enrollmentNumber = String(input ?? "").trim().toUpperCase();
  if (!enrollmentNumber) throw new Error("EMPTY_ENROLLMENT_NUMBER");
  if (!/^(BE|BT|MC|ME|MT)/.test(enrollmentNumber)) throw new Error("INVALID_PROGRAMME_PREFIX");
  if (enrollmentNumber.length !== 11) throw new Error("INVALID_ENROLLMENT_LENGTH");
  if (enrollmentNumber[7] !== "F") throw new Error("INVALID_EIGHTH_CHARACTER");
  if (!/^\d{2}$/.test(enrollmentNumber.slice(2, 4))) throw new Error("INVALID_ADMISSION_YEAR");
  const prefix = enrollmentNumber.slice(0, 2);
  const admissionModeCode = enrollmentNumber.slice(4, 5);
  if (!/^[FS]$/.test(admissionModeCode)) throw new Error("INVALID_ADMISSION_MODE");
  if ((prefix === "ME" || prefix === "MT") && admissionModeCode !== "F") throw new Error("POSTGRADUATE_REGULAR_ADMISSION_ONLY");
  if (!/^\d{2}$/.test(enrollmentNumber.slice(5, 7))) throw new Error("INVALID_BRANCH_CODE");
  if (!/^\d{3}$/.test(enrollmentNumber.slice(-3))) throw new Error("INVALID_STUDENT_SERIAL");
  const yy = Number(enrollmentNumber.slice(2, 4));
  const admissionYear = yy >= pivotStart ? 1900 + yy : 2000 + yy;
  validateEnrollmentYear(prefix, admissionYear, admissionModeCode, now);
  return {
    enrollmentNumber, classificationKey: enrollmentNumber.slice(0, 7),
    prefix,
    admissionYear,
    admissionModeCode,
    branchCode: enrollmentNumber.slice(5, 7), suffix: enrollmentNumber.slice(7),
  };
}
/**
 * Compares academic branch labels without relying on punctuation or display-name suffixes.
 * Abbreviations are limited to well-known engineering branch names; unknown labels require an exact normalized match.
 */
function normalizeBranchLabel(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(department|engineering|branch|of|the|and)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

const branchAliasGroups: string[][] = [
  ["information technology", "information tech", "it"],
  ["computer science and engineering", "computer science", "cse", "cs"],
  ["electronics and telecommunication", "electronics and communication", "electronics telecommunication", "e and tc", "etc", "extc", "ece", "entc"],
  ["electrical", "electrical engineering", "electr", "elect", "ee"],
  ["mechanical", "mechanical engineering", "mech", "me"],
  ["civil", "civil engineering", "ce"],
  ["computer engineering", "computer engg", "coe"],
  ["artificial intelligence and data science", "artificial intelligence data science", "ai and ds", "aids"],
  ["artificial intelligence and machine learning", "artificial intelligence machine learning", "ai and ml", "aiml"],
];

function branchAliasKey(value: string): string | null {
  const normalized = normalizeBranchLabel(value);
  if (!normalized) return null;
  for (const group of branchAliasGroups) {
    const aliases = group.map(normalizeBranchLabel);
    if (aliases.some(alias => normalized === alias || (alias.length >= 8 && normalized.startsWith(alias)) || (normalized.length >= 8 && alias.startsWith(normalized)))) {
      return aliases[0];
    }
  }
  return null;
}

export function branchIdentityMatches(configuredName: string, actualName: string, actualCode?: string | null): boolean {
  const configured = normalizeBranchLabel(configuredName);
  const actual = normalizeBranchLabel(actualName);
  if (configured && actual && configured === actual) return true;
  const configuredAlias = branchAliasKey(configuredName);
  if (configuredAlias && configuredAlias === branchAliasKey(actualName)) return true;
  if (actualCode) {
    const code = normalizeBranchLabel(actualCode);
    if (configured && code && configured === code) return true;
    const codeAlias = branchAliasKey(actualCode);
    if (configuredAlias && configuredAlias === codeAlias) return true;
  }
  return false;
}

export type EnrollmentBranchCandidate = {
  name: string;
  code?: string | null;
  specializationName?: string | null;
  specializationCode?: string | null;
};

/**
 * M.Tech enrollment codes identify a specialization (for example Structural
 * Engineering), while the curriculum's branch_id points to its department
 * (for example Applied Mechanics). Match the specialization first; use the
 * department only when that curriculum has no specialization record.
 */
// Some GECA M.Tech curricula are stored against their department branch
// without a specialization_id. These parent-department relationships are
// explicitly defined by the institution's M.Tech curriculum structure.
const mtechDepartmentFallbacks: Record<string, string[]> = {
  "structural engineering": ["applied mechanics"],
  "water resources engineering": ["civil"],
  "geotechnical engineering": ["civil"],
};

export function enrollmentBranchMatches(
  prefix: string,
  decodedBranchName: string,
  candidate: EnrollmentBranchCandidate,
): boolean {
  if (prefix === "MT") {
    const specializationName = String(candidate.specializationName ?? "").trim();
    if (specializationName) {
      // Postgraduate codes identify a specific specialization. Use the shared
      // identity matcher so institutional labels such as "Electronics &
      // Telecommunication Engineering (ENTC)" match the canonical GECA stream,
      // without allowing the broader "Electronics Engineering" branch to match.
      return branchIdentityMatches(decodedBranchName, specializationName, candidate.specializationCode ?? null);
    }

    // A department match alone is insufficient for M.Tech: the enrollment
    // code must resolve to a configured specialization within that department.
    return false;
  }
  return branchIdentityMatches(decodedBranchName, candidate.name, candidate.code ?? null);
}
export type SemesterPrediction = {
  expectedSemester: number | null;
  academicYear: string;
  semesterType: "ODD" | "EVEN";
  academicYearLabel: "First Year" | "Second Year" | "Third Year" | "Final Year" | null;
  expectedGraduationSession: string;
  expectedDurationEnded: boolean;
  progressionStatus: "ESTIMATED";
};

/** One academic-session based calculation. A null semester means normal duration has ended. */
export function predictSemester(input: {
  admissionYear: number; entrySemester: number; totalSemesters: number;
  academicYearStartMonth: number; oddSemesterStartMonth: number; oddSemesterEndMonth: number;
  date?: Date;
}): SemesterPrediction {
  const date = input.date ?? new Date();
  const month = date.getMonth() + 1;
  const startYear = month >= input.academicYearStartMonth ? date.getFullYear() : date.getFullYear() - 1;
  const inOddWindow = input.oddSemesterStartMonth <= input.oddSemesterEndMonth
    ? month >= input.oddSemesterStartMonth && month <= input.oddSemesterEndMonth
    : month >= input.oddSemesterStartMonth || month <= input.oddSemesterEndMonth;
  const semesterType: "ODD" | "EVEN" = inOddWindow ? "ODD" : "EVEN";
  const sessionOffset = semesterType === "ODD" ? 0 : 1;
  const expected = input.entrySemester + (startYear - input.admissionYear) * 2 + sessionOffset;
  const expectedSemester = expected < input.entrySemester || expected > input.totalSemesters ? null : expected;
  const academicYearLabel = expectedSemester === null ? null :
    Math.ceil(expectedSemester / 2) === 1 ? "First Year" :
    Math.ceil(expectedSemester / 2) === 2 ? "Second Year" :
    Math.ceil(expectedSemester / 2) === 3 ? "Third Year" : "Final Year";
  const graduationYear = input.admissionYear + Math.ceil((input.totalSemesters - input.entrySemester + 1) / 2);
  return {
    expectedSemester, academicYear: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
    semesterType, academicYearLabel,
    expectedGraduationSession: `${graduationYear}-${String((graduationYear + 1) % 100).padStart(2, "0")}`,
    expectedDurationEnded: expected > input.totalSemesters,
    progressionStatus: "ESTIMATED",
  };
}


/** Prefix-specific scheme guard. Unknown/blank schemes must be resolved manually. */
export function isAllowedSchemeForEnrollmentPrefix(prefix: string, schemeName: string | null | undefined): boolean {
  const name = String(schemeName ?? "").trim();
  if (!name) return false;
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (prefix === "BE" || prefix === "ME") return /^new cbcs(?:\s|$)/.test(normalized) && !/\b(nep|new education policy|national education policy)\b/.test(normalized);
  if (prefix === "BT" || prefix === "MT") return /\b(nep|new education policy|national education policy)\b/.test(normalized) && !/\b(cbcs|legacy)\b/.test(normalized);
  return prefix === "MC" && normalized.length > 0;
}




/** Degree identity comes from the enrollment prefix, not configurable programme-name patterns. */
export function programmeMatchesEnrollmentPrefix(prefix: string, programmeName: string): boolean {
  const name = String(programmeName ?? "").normalize("NFKC").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return false;

  // BE and BT are two enrollment-prefix generations used for the same broad
  // undergraduate engineering programme family in this institution's directory.
  // Older records may be titled B.E. while newer directory rows say B.Tech (or vice versa).
  // Keep the match token-based; never match an unrelated degree by substring.
  const engineeringDegreePatterns = [
    /(?:^| )(?:bachelor of engineering|bachelor in engineering|bachelors of engineering|bachelors in engineering|bachelor engineering|bachelors engineering|bachelor of engg|bachelor in engg|bachelor engg|b engg|b e|be)(?: |$)/,
    /(?:^| )(?:bachelor of technology|bachelor in technology|bachelors of technology|bachelors in technology|bachelor technology|bachelors technology|bachelor of tech|b tech|b t e c h|btech|bt)(?: |$)/,
  ];
  const postgraduatePatterns: Record<string, RegExp> = {
    MC: /(?:^| )(?:master of computer applications|master in computer applications|masters of computer applications|master computer applications|m c a|mca|mc)(?: |$)/,
    ME: /(?:^| )(?:master of engineering|master in engineering|masters of engineering|master engineering|master of engg|m engg|m e|me)(?: |$)/,
    MT: /(?:^| )(?:master of technology|master in technology|masters of technology|master technology|master of tech|m tech|m t e c h|mtech|mt)(?: |$)/,
  };

  if (prefix === "BE" || prefix === "BT") return name === "engineering" || name === "undergraduate engineering" || engineeringDegreePatterns.some(pattern => pattern.test(name));
  return Boolean(postgraduatePatterns[prefix]?.test(name));
}

/** Deterministic GECA enrollment branch decoding. The database is not consulted to interpret these codes. */
export function resolveEnrollmentBranchCode(institutionName: string, prefix: string, branchCode: string): string | null {
  const institution = String(institutionName ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const isGeCa = institution.includes("government college of engineering") &&
    (institution.includes("aurangabad") || institution.includes("chhatrapati sambhajinagar") || institution.includes("sambhajinagar"));
  if (!isGeCa) return null;
  if (prefix === "ME") return null; // ME codes remain institution-directory-specific.
  if (prefix === "MT") {
    const postgraduateBranches: Record<string, string> = {
      "09": "Structural Engineering", "08": "Water Resources Engineering", "16": "Geotechnical Engineering",
      "15": "Electrical Machines and Drives", "12": "Electrical Power Systems", "13": "Electronics and Telecommunication Engineering",
      "05": "Computer Science and Engineering",
      // Production Engineering code has not been supplied; deliberately do not guess.
    };
    return postgraduateBranches[branchCode] ?? null;
  }
  if (!["BE", "BT"].includes(prefix)) return null;
  const branches: Record<string, string> = {
    "01": "Civil Engineering",
    "02": "Mechanical Engineering",
    "03": "Electrical Engineering",
    "04": "Electronics and Telecommunication Engineering",
    "05": "Computer Science and Engineering",
    "06": "Information Technology",
  };
  return branches[branchCode] ?? null;
}
