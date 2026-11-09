export type EnrollmentComponents = {
  enrollmentNumber: string; classificationKey: string; prefix: string; admissionYear: number;
  admissionModeCode: string; branchCode: string; suffix: string;
};

export function parseEnrollmentNumber(input: string, pivotStart = 70): EnrollmentComponents {
  // Normalize case and outer whitespace only. Never repair or remove internal characters.
  const enrollmentNumber = String(input ?? "").trim().toUpperCase();
  if (!enrollmentNumber) throw new Error("EMPTY_ENROLLMENT_NUMBER");
  if (!/^(BE|BT|MC|MT)/.test(enrollmentNumber)) throw new Error("INVALID_PROGRAMME_PREFIX");
  if (enrollmentNumber.length !== 11) throw new Error("INVALID_ENROLLMENT_LENGTH");
  if (enrollmentNumber[7] !== "F") throw new Error("INVALID_EIGHTH_CHARACTER");
  if (!/^\d{2}$/.test(enrollmentNumber.slice(2, 4))) throw new Error("INVALID_ADMISSION_YEAR");
  if (!/^[FS]$/.test(enrollmentNumber.slice(4, 5))) throw new Error("INVALID_ADMISSION_MODE");
  if (!/^\d{2}$/.test(enrollmentNumber.slice(5, 7))) throw new Error("INVALID_BRANCH_CODE");
  if (!/^\d{3}$/.test(enrollmentNumber.slice(-3))) throw new Error("INVALID_STUDENT_SERIAL");
  const yy = Number(enrollmentNumber.slice(2, 4));
  return {
    enrollmentNumber, classificationKey: enrollmentNumber.slice(0, 7),
    prefix: enrollmentNumber.slice(0, 2),
    admissionYear: yy >= pivotStart ? 1900 + yy : 2000 + yy,
    admissionModeCode: enrollmentNumber.slice(4, 5),
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
  ["electronics and telecommunication", "electronics and communication", "electronics telecommunication", "e and tc", "etc", "extc", "ece"],
  ["electrical", "electrical engineering", "electr", "ee"],
  ["mechanical", "mechanical engineering", "me"],
  ["civil", "civil engineering", "ce"],
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
  if (prefix === "BE") return /^new cbcs(?:\s|$)/.test(normalized) && !/\b(nep|new education policy|national education policy)\b/.test(normalized);
  if (prefix === "BT") return /\b(nep|new education policy|national education policy)\b/.test(normalized) && !/\b(cbcs|legacy)\b/.test(normalized);
  return (prefix === "MC" || prefix === "MT") && normalized.length > 0;
}

