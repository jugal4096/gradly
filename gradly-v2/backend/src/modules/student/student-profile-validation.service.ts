import { pool } from "../../config/database";
import { branchIdentityMatches, isAllowedSchemeForEnrollmentPrefix, parseEnrollmentNumber, predictSemester, programmeMatchesEnrollmentPrefix, resolveEnrollmentBranchCode } from "../academic/enrollment-progression";

export class StudentProfileValidationError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "StudentProfileValidationError"; }
}

type ProfileInput = {
  institutionId: string; curriculumId: string; studentIdentifier: string;
  admissionYear: number; admissionModeName: string | null; currentSemesterNumber: number | null;
  academicStatus: string;
  pendingBacklogCount?: number | null;
  academicProfileOverrides?: Record<string, unknown>;
};

export async function validateStudentProfileConfiguration(input: ProfileInput): Promise<number | null> {
  let parsed;
  try { parsed = parseEnrollmentNumber(input.studentIdentifier); }
  catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_ENROLLMENT_NUMBER";
    const messageByCode: Record<string, string> = {
      DSE_ADMISSION_CYCLE_NOT_STARTED: "Direct Second Year admission for this enrollment year has not started yet. DSE intake becomes eligible only when the corresponding first-year cohort enters its second academic year, at the start of that session (normally July).",
      FUTURE_ADMISSION_YEAR: "This enrollment year has not started yet. Future-dated enrollment numbers are not accepted.",
      BE_CBCS_DISCONTINUED: "The BE New CBCS scheme was discontinued after 2023. BE24 and later BE enrollment years are invalid.",
      BE23_FIRST_YEAR_NOT_ALLOWED: "BE23F is invalid because first-year admissions had moved to NEP. BE23S Direct Second Year remains valid.",
      BT_NEP_NOT_STARTED: "BT enrollment numbers before 2023 are invalid because the NEP scheme had not started.",
      POSTGRADUATE_REGULAR_ADMISSION_ONLY: "M.E. and M.Tech. enrollment numbers must use Regular admission (F) and begin in Semester 1.",
      ME_CBCS_DISCONTINUED: "The ME New CBCS scheme ended before the 2023 NEP transition. ME23 and later ME enrollment years are invalid.",
      MT_NEP_NOT_STARTED: "MT enrollment numbers before 2023 are invalid because the NEP scheme had not started.",
    };
    throw new StudentProfileValidationError(code, messageByCode[code] ?? "Enrollment number is invalid. Check the 11-character format and try again.");
  }

  if (input.admissionYear !== parsed.admissionYear && input.academicProfileOverrides?.admissionYear !== true) {
    throw new StudentProfileValidationError(
      "ADMISSION_YEAR_MISMATCH",
      "The admission year does not match the year encoded in your enrollment number. Edit it only if the enrollment number itself has been officially corrected.",
    );
  }

  const programmeRule = await pool.query(
    `SELECT prefix FROM public.enrollment_program_rules
     WHERE prefix = $1 AND (institution_id = $2 OR institution_id IS NULL)
     ORDER BY (institution_id = $2) DESC NULLS LAST LIMIT 1`,
    [parsed.prefix, input.institutionId],
  );
  if (!programmeRule.rows[0] && parsed.prefix !== "ME" && parsed.prefix !== "MT") throw new StudentProfileValidationError("PROGRAMME_PREFIX_NOT_CONFIGURED", "This enrollment prefix is not configured for the selected institution.");

  const curriculumResult = await pool.query(
    `SELECT c.id, c.institution_id,
            COALESCE(c.total_semesters, (SELECT COUNT(*)::int FROM public.semesters sem WHERE sem.curriculum_id = c.id)) AS total_semesters,
            p.name AS program_name, b.name AS branch_name, b.code AS branch_code, sc.name AS scheme_name
     FROM public.curricula c
     JOIN public.programs p ON p.id = c.program_id
     JOIN public.branches b ON b.id = c.branch_id
     JOIN public.schemes sc ON sc.id = c.scheme_id
     WHERE c.id = $1 AND c.institution_id = $2 LIMIT 1`,
    [input.curriculumId, input.institutionId],
  );
  const curriculum = curriculumResult.rows[0];
  if (!curriculum) throw new StudentProfileValidationError("CURRICULUM_INSTITUTION_MISMATCH", "Selected curriculum does not belong to the selected institution.");

  const programName = String(curriculum.program_name || "");
  if (!programmeMatchesEnrollmentPrefix(parsed.prefix, programName)) {
    throw new StudentProfileValidationError("PROGRAMME_PREFIX_MISMATCH", "The selected programme does not match the degree prefix in your enrollment number.");
  }
  if (!isAllowedSchemeForEnrollmentPrefix(parsed.prefix, String(curriculum.scheme_name || ""))) {
    const expected = parsed.prefix === "BE" || parsed.prefix === "ME" ? "New CBCS" : parsed.prefix === "BT" || parsed.prefix === "MT" ? "NEP" : "the configured MCA scheme";
    throw new StudentProfileValidationError("SCHEME_PREFIX_MISMATCH", `The selected academic scheme is not valid for this enrollment prefix. Expected ${expected}.`);
  }

  if (input.academicProfileOverrides?.branch !== true) {
    const institutionResult = await pool.query(`SELECT name FROM public.institutions WHERE id = $1 LIMIT 1`, [input.institutionId]);
    const decodedBranchName = resolveEnrollmentBranchCode(String(institutionResult.rows[0]?.name ?? ""), parsed.prefix, parsed.branchCode);
    const branchMatches = parsed.prefix === "ME"
      ? String(curriculum.branch_code ?? "").trim().toUpperCase() === parsed.branchCode
      : Boolean(decodedBranchName && branchIdentityMatches(decodedBranchName, String(curriculum.branch_name || "")));
    if (!branchMatches) {
      throw new StudentProfileValidationError("BRANCH_CODE_MISMATCH", "Selected branch does not match the built-in enrollment decoder. If your institution uses a different code structure, explicitly correct the branch or submit an enrollment grievance.");
    }
  }

  const modeResult = await pool.query(
    `SELECT em.mode_name, em.entry_semester
     FROM public.enrollment_admission_modes em
     WHERE (((UPPER(BTRIM(em.mode_code)) = $1 OR ($1 = 'F' AND LOWER(BTRIM(em.mode_name)) IN ('regular','first year','fy')) OR ($1 = 'S' AND LOWER(BTRIM(em.mode_name)) IN ('direct second year','dsy','dse','lateral entry'))) AND $5::boolean = FALSE)
         OR ($5::boolean = TRUE AND LOWER(em.mode_name) = LOWER($4)))
       AND (em.institution_id = $2 OR em.institution_id IS NULL)
       AND (em.programme_prefix = $3 OR em.programme_prefix IS NULL)
     ORDER BY (em.institution_id = $2) DESC NULLS LAST,
              (em.programme_prefix = $3) DESC NULLS LAST LIMIT 1`,
    [parsed.admissionModeCode, input.institutionId, parsed.prefix, input.admissionModeName ?? "", input.academicProfileOverrides?.admissionMode === true],
  );
  let mode = modeResult.rows[0];
  if (!mode && (parsed.prefix === "ME" || parsed.prefix === "MT")) {
    const regularMode = await pool.query(`SELECT name AS mode_name, 1 AS entry_semester FROM public.admission_modes WHERE LOWER(name) = 'regular' LIMIT 1`);
    mode = regularMode.rows[0];
  }
  if (!mode) throw new StudentProfileValidationError("ADMISSION_MODE_NOT_CONFIGURED", "This admission mode is not configured for the selected institute and programme.");
  if ((parsed.prefix === "ME" || parsed.prefix === "MT") && (parsed.admissionModeCode !== "F" || !/regular/i.test(String(mode.mode_name)) || Number(mode.entry_semester) !== 1)) {
    throw new StudentProfileValidationError("POSTGRADUATE_REGULAR_ADMISSION_ONLY", "M.E. and M.Tech. admissions must be Regular first-year entry in Semester 1.");
  }
  if (String(input.admissionModeName ?? "").trim().toLowerCase() !== String(mode.mode_name).trim().toLowerCase()) {
    throw new StudentProfileValidationError("ADMISSION_MODE_MISMATCH", "Selected admission mode is not configured for this programme and institution.");
  }

  const totalSemesters = Number(curriculum.total_semesters);
  const entrySemester = Number(mode.entry_semester);
  if (!Number.isInteger(totalSemesters) || totalSemesters < 1 || !Number.isInteger(entrySemester) || entrySemester < 1 || entrySemester > totalSemesters) {
    throw new StudentProfileValidationError("CURRICULUM_DURATION_INVALID", "The selected curriculum has an invalid semester configuration.");
  }
  if (input.academicStatus === "GRADUATED") {
    if (Number(input.pendingBacklogCount || 0) > 0) throw new StudentProfileValidationError("GRADUATION_BACKLOG_CONFLICT", "A student with pending backlogs cannot be marked as having completed the degree.");
    if (input.currentSemesterNumber !== null) throw new StudentProfileValidationError("GRADUATION_SEMESTER_INVALID", "A completed programme cannot have an active current semester.");
    return null;
  }

  const calendarResult = await pool.query(
    `SELECT academic_year_start_month, odd_semester_start_month, odd_semester_end_month, timezone, active_from, active_to
     FROM public.institution_academic_calendars WHERE institution_id = $1
     ORDER BY active_from DESC NULLS LAST`,
    [input.institutionId],
  );
  const calendars = calendarResult.rows as Array<{ academic_year_start_month:number; odd_semester_start_month:number; odd_semester_end_month:number; timezone:string|null; active_from:string|Date|null; active_to:string|Date|null }>;
  const calendar = calendars.find(row => {
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone || "Asia/Kolkata", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
    const dateOnly = (value: string | Date | null) => value ? (value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10)) : null;
    const activeFrom = dateOnly(row.active_from);
    const activeTo = dateOnly(row.active_to);
    return (!activeFrom || activeFrom <= localDate) && (!activeTo || activeTo >= localDate);
  });
  if (!calendar) throw new StudentProfileValidationError("ACADEMIC_CALENDAR_MISSING", "The institute academic calendar is not configured for the current date.");

  const localParts = new Intl.DateTimeFormat("en-US", { timeZone: calendar.timezone || "Asia/Kolkata", year:"numeric", month:"numeric", day:"numeric" }).formatToParts(new Date());
  const part = (type:string) => Number(localParts.find(item => item.type === type)?.value);
  const localDate = new Date(part("year"), part("month") - 1, part("day"), 12);
  const prediction = predictSemester({
    admissionYear: input.admissionYear, entrySemester, totalSemesters,
    academicYearStartMonth: Number(calendar.academic_year_start_month),
    oddSemesterStartMonth: Number(calendar.odd_semester_start_month),
    oddSemesterEndMonth: Number(calendar.odd_semester_end_month), date: localDate,
  });
  const selected = Number(input.currentSemesterNumber);
  if (!Number.isInteger(selected) || selected < entrySemester || selected > totalSemesters) {
    throw new StudentProfileValidationError("CURRENT_SEMESTER_OUT_OF_RANGE", "Current semester must be within the selected programme's semester range and admission entry point.");
  }
  const highestAllowed = prediction.expectedSemester ?? (prediction.expectedDurationEnded ? totalSemesters : 0);
  if (selected > highestAllowed) {
    throw new StudentProfileValidationError("CURRENT_SEMESTER_AHEAD_OF_PREDICTION", "Selected semester is ahead of the semester Gradly can reasonably predict for the current academic session.");
  }
  return prediction.expectedSemester;
}
