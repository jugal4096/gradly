import { pool } from "../../config/database";

export type EnrollmentComponents = {
  enrollmentNumber: string;
  classificationKey: string;
  prefix: string;
  admissionYear: number;
  admissionModeCode: string;
  branchCode: string;
  suffix: string;
};

export type SemesterPrediction = {
  expectedSemester: number | null;
  academicYear: string | null;
  semesterType: "ODD" | "EVEN" | null;
  academicYearLabel: "First Year" | "Second Year" | "Third Year" | "Final Year" | null;
  expectedGraduationSession: string | null;
  expectedDurationEnded: boolean;
  progressionStatus: "ESTIMATED" | "CONFIGURATION_REQUIRED";
};

export function parseEnrollmentNumber(input: string, pivotStart = 70): EnrollmentComponents {
  const enrollmentNumber = String(input ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
  if (enrollmentNumber.length < 8 || !/^[A-Z]{2}\d{2}[A-Z]\d{2}[A-Z0-9]+$/.test(enrollmentNumber)) {
    throw new Error("INVALID_ENROLLMENT_NUMBER");
  }
  const prefix = enrollmentNumber.slice(0, 2);
  const yearPart = Number(enrollmentNumber.slice(2, 4));
  const admissionYear = yearPart >= pivotStart ? 1900 + yearPart : 2000 + yearPart;
  return {
    enrollmentNumber,
    classificationKey: enrollmentNumber.slice(0, 7),
    prefix,
    admissionYear,
    admissionModeCode: enrollmentNumber.slice(4, 5),
    branchCode: enrollmentNumber.slice(5, 7),
    suffix: enrollmentNumber.slice(7),
  };
}

function academicYearFor(date: Date, startMonth: number) {
  const year = date.getFullYear();
  const startYear = date.getMonth() + 1 >= startMonth ? year : year - 1;
  return { startYear, label: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}` };
}

export function predictSemester(input: {
  admissionYear: number;
  entrySemester: number;
  totalSemesters: number;
  durationYears: number;
  academicYearStartMonth: number;
  oddSemesterStartMonth: number;
  oddSemesterEndMonth: number;
  date?: Date;
}): SemesterPrediction {
  const date = input.date ?? new Date();
  const month = date.getMonth() + 1;
  const { startYear, label } = academicYearFor(date, input.academicYearStartMonth);
  const semesterType: "ODD" | "EVEN" = month >= input.oddSemesterStartMonth && month <= input.oddSemesterEndMonth ? "ODD" : "EVEN";
  const semesterOffset = semesterType === "ODD" ? 0 : 1;
  const rawSemester = input.entrySemester + (startYear - input.admissionYear) * 2 + semesterOffset;
  const expectedGraduationYear = input.admissionYear + input.durationYears;
  const expectedDurationEnded = rawSemester > input.totalSemesters ||
    date.getFullYear() > expectedGraduationYear ||
    (date.getFullYear() === expectedGraduationYear && month >= input.academicYearStartMonth);
  const expectedSemester = rawSemester < input.entrySemester ? input.entrySemester :
    rawSemester > input.totalSemesters ? null : rawSemester;
  const yearIndex = expectedSemester === null ? null : Math.ceil(expectedSemester / 2);
  const academicYearLabel = yearIndex === null ? null :
    yearIndex === 1 ? "First Year" : yearIndex === 2 ? "Second Year" :
    yearIndex === 3 ? "Third Year" : "Final Year";
  return {
    expectedSemester, academicYear: label, semesterType, academicYearLabel,
    expectedGraduationSession: `${expectedGraduationYear}-${String((expectedGraduationYear + 1) % 100).padStart(2, "0")}`,
    expectedDurationEnded, progressionStatus: "ESTIMATED",
  };
}

/** Resolves all classification rules from institution-aware configuration and academic master data. */
export async function previewEnrollment(institutionId: string, rawEnrollmentNumber: string, now = new Date()) {
  const base = parseEnrollmentNumber(rawEnrollmentNumber);
  const rulesResult = await pool.query(
    `SELECT prefix, programme_name_pattern, scheme_label, duration_years, total_semesters,
            regular_entry_semester, lateral_entry_semester, year_pivot_start
     FROM enrollment_program_rules
     WHERE institution_id = $1 OR institution_id IS NULL
     ORDER BY institution_id NULLS LAST`, [institutionId],
  );
  const prefixRule = rulesResult.rows.find((row: any) => row.prefix === base.prefix);
  if (!prefixRule) return { recognized: false, requiresConfirmation: true, unknown: "PROGRAMME_PREFIX", message: "This enrollment prefix is not configured for your institution." };

  const pivot = Number(prefixRule.year_pivot_start ?? 70);
  const parsed = parseEnrollmentNumber(rawEnrollmentNumber, pivot);
  const modeResult = await pool.query(
    `SELECT mode_code, mode_name, entry_semester FROM enrollment_admission_modes
     WHERE mode_code = $1 AND (institution_id = $2 OR institution_id IS NULL)
       AND (programme_prefix = $3 OR programme_prefix IS NULL)
     ORDER BY institution_id NULLS LAST, programme_prefix NULLS LAST`, [parsed.admissionModeCode, institutionId, parsed.prefix],
  );
  const mode = modeResult.rows[0];
  if (!mode) return { recognized: false, requiresConfirmation: true, unknown: "ADMISSION_MODE", parsed };

  const branchResult = await pool.query(
    `SELECT branch_name, program_name_pattern FROM enrollment_branch_codes
     WHERE branch_code = $1 AND (institution_id = $2 OR institution_id IS NULL)
     ORDER BY institution_id NULLS LAST`, [parsed.branchCode, institutionId],
  );
  const branch = branchResult.rows[0];
  if (!branch) return { recognized: false, requiresConfirmation: true, unknown: "BRANCH_CODE", parsed };

  const programResult = await pool.query(
    `SELECT p.id AS program_id, p.name AS program_name, p.level AS program_level,
            b.id AS branch_id, b.name AS branch_name
     FROM programs p JOIN branches b ON b.program_id = p.id
     WHERE p.institution_id = $1 AND p.name ILIKE $2 AND b.name ILIKE $3
     LIMIT 2`,
    [institutionId, prefixRule.programme_name_pattern, branch.branch_name],
  );
  const academicMatch = programResult.rows[0];
  if (!academicMatch) return { recognized: false, requiresConfirmation: true, unknown: "INSTITUTION_PROGRAM_OR_BRANCH", parsed };

  const calendarResult = await pool.query(
    `SELECT academic_year_start_month, odd_semester_start_month, odd_semester_end_month
     FROM institution_academic_calendars
     WHERE institution_id = $1 AND (active_from IS NULL OR active_from <= $2::date)
       AND (active_to IS NULL OR active_to >= $2::date)
     ORDER BY active_from DESC NULLS LAST LIMIT 1`, [institutionId, now.toISOString().slice(0, 10)],
  );
  const calendar = calendarResult.rows[0];
  const durationYears = Number(prefixRule.duration_years);
  const totalSemesters = Number(prefixRule.total_semesters);
  if (!calendar || !durationYears || !totalSemesters || !prefixRule.scheme_label) {
    return {
      recognized: true, requiresConfirmation: true, parsed,
      programme: academicMatch.program_name, programId: academicMatch.program_id,
      branch: academicMatch.branch_name, branchId: academicMatch.branch_id,
      admissionYear: parsed.admissionYear, admissionMode: mode.mode_name,
      scheme: prefixRule.scheme_label ?? null,
      configurationRequired: !calendar ? "ACADEMIC_CALENDAR" : !prefixRule.scheme_label ? "ACADEMIC_SCHEME" : "PROGRAMME_DURATION",
    };
  }
  const prediction = predictSemester({
    admissionYear: parsed.admissionYear, entrySemester: Number(mode.entry_semester),
    totalSemesters, durationYears, academicYearStartMonth: Number(calendar.academic_year_start_month),
    oddSemesterStartMonth: Number(calendar.odd_semester_start_month),
    oddSemesterEndMonth: Number(calendar.odd_semester_end_month), date: now,
  });
  return {
    recognized: true, requiresConfirmation: false, parsed,
    programme: academicMatch.program_name, programId: academicMatch.program_id,
    branch: academicMatch.branch_name, branchId: academicMatch.branch_id,
    admissionYear: parsed.admissionYear, admissionMode: mode.mode_name,
    entrySemester: Number(mode.entry_semester), scheme: prefixRule.scheme_label,
    expected: prediction,
    verified: { status: "UNVERIFIED", currentSemester: null, academicYear: null, gapYears: null, backlogs: null, graduationStatus: "NOT_VERIFIED" },
  };
}
