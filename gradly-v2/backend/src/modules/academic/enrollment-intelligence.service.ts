import { pool } from "../../config/database";

export type EnrollmentComponents = {
  enrollmentNumber: string; classificationKey: string; prefix: string; admissionYear: number;
  admissionModeCode: string; branchCode: string; suffix: string;
};

export function parseEnrollmentNumber(input: string, pivotStart = 70): EnrollmentComponents {
  const enrollmentNumber = String(input ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
  if (enrollmentNumber.length < 8 || !/^[A-Z]{2}\d{2}[A-Z]\d{2}[A-Z0-9]+$/.test(enrollmentNumber)) {
    throw new Error("INVALID_ENROLLMENT_NUMBER");
  }
  const yy = Number(enrollmentNumber.slice(2, 4));
  return {
    enrollmentNumber, classificationKey: enrollmentNumber.slice(0, 7),
    prefix: enrollmentNumber.slice(0, 2),
    admissionYear: yy >= pivotStart ? 1900 + yy : 2000 + yy,
    admissionModeCode: enrollmentNumber.slice(4, 5),
    branchCode: enrollmentNumber.slice(5, 7), suffix: enrollmentNumber.slice(7),
  };
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

const unresolved = (reason: string, message: string, parsed: EnrollmentComponents) =>
  ({ recognized: false, requiresConfirmation: true, unknown: reason, message, parsed });

export async function previewEnrollment(institutionId: string, rawEnrollmentNumber: string, now = new Date()) {
  const initial = parseEnrollmentNumber(rawEnrollmentNumber);
  const rules = await pool.query(
    `SELECT prefix, programme_name_pattern, scheme_label, duration_years, total_semesters, year_pivot_start
     FROM enrollment_program_rules
     WHERE institution_id = $1 OR institution_id IS NULL
     ORDER BY (institution_id = $1) DESC NULLS LAST`, [institutionId],
  );
  const rule = rules.rows.find((row: any) => row.prefix === initial.prefix);
  if (!rule) return unresolved("PROGRAMME_PREFIX", "This programme prefix is not configured for your institution.", initial);
  const parsed = parseEnrollmentNumber(rawEnrollmentNumber, Number(rule.year_pivot_start ?? 70));

  const programResult = await pool.query(
    `SELECT id, name, level FROM programs
     WHERE institution_id = $1 AND name ILIKE $2 ORDER BY name LIMIT 2`,
    [institutionId, rule.programme_name_pattern],
  );
  if (programResult.rows.length !== 1) {
    return unresolved("PROGRAMME", programResult.rows.length ? "More than one programme matches this enrollment prefix. Institutional mapping needs review." : "The matching programme is not available in this institution's academic directory.", parsed);
  }
  const program = programResult.rows[0];

  const branchResult = await pool.query(
    `SELECT branch_name, program_name_pattern FROM enrollment_branch_codes
     WHERE branch_code = $1 AND (institution_id = $2 OR institution_id IS NULL)
     ORDER BY (institution_id = $2) DESC NULLS LAST LIMIT 1`,
    [parsed.branchCode, institutionId],
  );
  const branchRule = branchResult.rows[0];
  if (!branchRule) return unresolved("BRANCH_CODE", "This branch code is not configured. Please request verification.", parsed);
  const branchResultMatch = await pool.query(
    `SELECT id, name FROM branches WHERE program_id = $1 AND name ILIKE $2 LIMIT 2`,
    [program.id, branchRule.branch_name],
  );
  if (branchResultMatch.rows.length !== 1) {
    return unresolved("BRANCH", branchResultMatch.rows.length ? "Multiple branch records match this code." : "The matching branch is not configured under this programme.", parsed);
  }
  const branch = branchResultMatch.rows[0];

  const modeResult = await pool.query(
    `SELECT mode_code, mode_name, entry_semester FROM enrollment_admission_modes
     WHERE mode_code = $1 AND (institution_id = $2 OR institution_id IS NULL)
       AND (programme_prefix = $3 OR programme_prefix IS NULL)
     ORDER BY (institution_id = $2) DESC NULLS LAST, (programme_prefix = $3) DESC NULLS LAST LIMIT 1`,
    [parsed.admissionModeCode, institutionId, parsed.prefix],
  );
  const mode = modeResult.rows[0];
  if (!mode) return unresolved("ADMISSION_MODE", "This admission-mode code is not configured for the detected programme.", parsed);

  if (!rule.scheme_label) {
    return { ...unresolved("SCHEME", "The academic scheme mapping for this programme needs institutional configuration.", parsed), programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id, admissionYear: parsed.admissionYear, admissionMode: mode.mode_name, entrySemester: Number(mode.entry_semester) };
  }
  const curriculumResult = await pool.query(
    `SELECT c.id, c.total_semesters, c.version, sc.name AS scheme_name
     FROM curricula c JOIN schemes sc ON sc.id = c.scheme_id
     WHERE c.institution_id = $1 AND c.program_id = $2 AND c.branch_id = $3
       AND sc.name ILIKE $4
     ORDER BY c.version DESC NULLS LAST LIMIT 2`,
    [institutionId, program.id, branch.id, `%${rule.scheme_label}%`],
  );
  if (curriculumResult.rows.length !== 1) {
    return {
      ...unresolved("CURRICULUM", curriculumResult.rows.length ? "Multiple curricula match the configured scheme. Please verify the curriculum mapping." : "No matching curriculum is configured for this programme and branch.", parsed),
      programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id,
      admissionYear: parsed.admissionYear, admissionMode: mode.mode_name,
      entrySemester: Number(mode.entry_semester), scheme: rule.scheme_label,
    };
  }
  const curriculum = curriculumResult.rows[0];
  const totalSemesters = Number(curriculum.total_semesters);
  const durationYears = Number(rule.duration_years);
  if (!Number.isInteger(totalSemesters) || totalSemesters < Number(mode.entry_semester) || !Number.isFinite(durationYears) || durationYears < 1) {
    return unresolved("PROGRAMME_DURATION", "Programme duration or semester count is not configured correctly.", parsed);
  }
  const calendarResult = await pool.query(
    `SELECT academic_year_start_month, odd_semester_start_month, odd_semester_end_month
     FROM institution_academic_calendars
     WHERE institution_id = $1 AND (active_from IS NULL OR active_from <= $2::date)
       AND (active_to IS NULL OR active_to >= $2::date)
     ORDER BY active_from DESC NULLS LAST LIMIT 1`,
    [institutionId, now.toISOString().slice(0, 10)],
  );
  const calendar = calendarResult.rows[0];
  if (!calendar) {
    return { ...unresolved("ACADEMIC_CALENDAR", "The institution's academic calendar is not configured for today's date.", parsed), programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id, curriculumId: curriculum.id };
  }
  const expected = predictSemester({
    admissionYear: parsed.admissionYear, entrySemester: Number(mode.entry_semester), totalSemesters,
    academicYearStartMonth: Number(calendar.academic_year_start_month),
    oddSemesterStartMonth: Number(calendar.odd_semester_start_month),
    oddSemesterEndMonth: Number(calendar.odd_semester_end_month), date: now,
  });
  return {
    recognized: true, requiresConfirmation: false, parsed,
    programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id,
    curriculumId: curriculum.id, curriculumName: curriculum.scheme_name,
    admissionYear: parsed.admissionYear, admissionMode: mode.mode_name,
    entrySemester: Number(mode.entry_semester), scheme: curriculum.scheme_name,
    expected,
    verified: { actualEnrolledSemester: null, academicDelay: null, gapYears: null, graduationStatus: "NOT_VERIFIED" },
  };
}
