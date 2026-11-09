import { pool } from "../../config/database";

import { branchIdentityMatches, isAllowedSchemeForEnrollmentPrefix, parseEnrollmentNumber, predictSemester } from "./enrollment-progression";
export { parseEnrollmentNumber, predictSemester } from "./enrollment-progression";
import type { EnrollmentComponents } from "./enrollment-progression";

const unresolved = (reason: string, message: string, parsed: EnrollmentComponents) =>
  ({ recognized: false, requiresConfirmation: true, unknown: reason, message, parsed });

export async function previewEnrollment(institutionId: string, rawEnrollmentNumber: string, now = new Date(), requestedCurriculumId?: string) {
  const initial = parseEnrollmentNumber(rawEnrollmentNumber);
  const rules = await pool.query(
    `SELECT prefix, programme_name_pattern, programme_alternate_pattern, programme_alias_patterns, scheme_label, duration_years, total_semesters, year_pivot_start
     FROM enrollment_program_rules
     WHERE institution_id = $1 OR institution_id IS NULL
     ORDER BY (institution_id = $1) DESC NULLS LAST`, [institutionId],
  );
  const rule = (rules.rows as Array<{ prefix: string; programme_name_pattern: string; programme_alternate_pattern: string | null; programme_alias_patterns: string[]; scheme_label: string | null; duration_years: number | null; total_semesters: number | null; year_pivot_start: number | null }>).find(row => row.prefix === initial.prefix);
  if (!rule) return unresolved("PROGRAMME_PREFIX", "This programme prefix is not configured for your institution.", initial);
  const parsed = parseEnrollmentNumber(rawEnrollmentNumber, Number(rule.year_pivot_start ?? 70));

  const programResult = await pool.query(
    `SELECT id, name, level FROM programs
     WHERE institution_id = $1 AND (name ILIKE $2 OR ($3::text IS NOT NULL AND name ILIKE $3) OR name ILIKE ANY($4::text[])) ORDER BY name LIMIT 2`,
    [institutionId, rule.programme_name_pattern, rule.programme_alternate_pattern ?? null, rule.programme_alias_patterns ?? []],
  );
  if (programResult.rows.length !== 1) {
    return unresolved("PROGRAMME", programResult.rows.length ? "More than one programme matches this enrollment prefix. Institutional mapping needs review." : "The matching programme is not available in this institution's academic directory.", parsed);
  }
  const program = programResult.rows[0];

  const branchResult = await pool.query(
    `SELECT branch_name, program_name_pattern,
            (institution_id = $2) AS institution_specific,
            (programme_prefix = $3) AS prefix_specific,
            (program_name_pattern IS NOT NULL) AS program_specific
     FROM enrollment_branch_codes
     WHERE branch_code = $1 AND (institution_id = $2 OR institution_id IS NULL)
       AND (programme_prefix = $3 OR programme_prefix IS NULL)
       AND (program_name_pattern IS NULL OR $4::text ILIKE program_name_pattern)
     ORDER BY (institution_id = $2) DESC NULLS LAST,
              (programme_prefix = $3) DESC NULLS LAST,
              (program_name_pattern IS NOT NULL) DESC NULLS LAST
     LIMIT 20`,
    [parsed.branchCode, institutionId, parsed.prefix, program.name],
  );
  const orderedBranchRules = branchResult.rows as Array<{ branch_name: string; program_name_pattern: string | null; institution_specific: boolean; prefix_specific: boolean; program_specific: boolean }>;
  const preferredRule = orderedBranchRules[0];
  const branchRules = preferredRule
    ? orderedBranchRules.filter(rule => rule.institution_specific === preferredRule.institution_specific && rule.prefix_specific === preferredRule.prefix_specific && rule.program_specific === preferredRule.program_specific)
    : [];
  if (!branchRules.length) {
    return unresolved("BRANCH_CODE", "Unrecognized branch code. Please verify your enrollment number.", parsed);
  }

  // Resolve against the programme-scoped branch directory instead of one exact display-name string.
  // Institutions commonly store abbreviations or expanded names, such as IT and Information Technology.
  const branchDirectory = await pool.query(
    `SELECT id, name, code FROM branches WHERE program_id = $1 ORDER BY name`,
    [program.id],
  );
  const matchedBranches = branchDirectory.rows.filter((candidate: { id: string; name: string; code?: string | null }) =>
    branchRules.some(rule => branchIdentityMatches(rule.branch_name, candidate.name, candidate.code ?? null)),
  );
  const uniqueBranches = Array.from(new Map(matchedBranches.map((candidate: { id: string }) => [candidate.id, candidate])).values());
  if (uniqueBranches.length !== 1) {
    return unresolved(
      "BRANCH",
      uniqueBranches.length
        ? "More than one branch matches this enrollment code under the detected programme. Institutional mapping needs review."
        : "Unrecognized branch code. Please verify your enrollment number.",
      parsed,
    );
  }
  const branch = uniqueBranches[0];

  const modeResult = await pool.query(
    `SELECT em.mode_code, em.mode_name, em.entry_semester, am.id AS admission_mode_id
     FROM enrollment_admission_modes em
     LEFT JOIN admission_modes am ON LOWER(am.name) = LOWER(em.mode_name)
     WHERE em.mode_code = $1 AND (em.institution_id = $2 OR em.institution_id IS NULL)
       AND (em.programme_prefix = $3 OR em.programme_prefix IS NULL)
     ORDER BY (em.institution_id = $2) DESC NULLS LAST, (em.programme_prefix = $3) DESC NULLS LAST LIMIT 1`,
    [parsed.admissionModeCode, institutionId, parsed.prefix],
  );
  const mode = modeResult.rows[0];
  if (!mode) return unresolved("ADMISSION_MODE", "This admission-mode code is not configured for the detected programme.", parsed);

  const curriculumOptionsResult = await pool.query(
    `SELECT c.id, c.scheme_id, sc.name AS scheme_name, sc.code AS scheme_code,
            c.version, c.total_semesters,
            COALESCE(c.total_semesters, COUNT(DISTINCT sem.semester_number)::int) AS resolved_total_semesters,
            COALESCE(c.total_semesters, COUNT(DISTINCT sem.semester_number)::int) AS configured_semesters
     FROM curricula c
     JOIN schemes sc ON sc.id = c.scheme_id
     LEFT JOIN semesters sem ON sem.curriculum_id = c.id
     WHERE c.institution_id = $1 AND c.program_id = $2 AND c.branch_id = $3
     GROUP BY c.id, sc.name, sc.code
     ORDER BY sc.name, c.version DESC NULLS LAST`,
    [institutionId, program.id, branch.id],
  );
  const curriculumOptions = curriculumOptionsResult.rows as Array<{
    id: string; scheme_id: string; scheme_name: string; scheme_code: string | null;
    version: string | number | null; total_semesters: number | null; resolved_total_semesters: number;
  }>;
  const configuredScheme = String(rule.scheme_label ?? "").trim();
  const allowedOptions = curriculumOptions.filter(option => isAllowedSchemeForEnrollmentPrefix(parsed.prefix, option.scheme_name));
  const schemeMatches = (scheme: string) => curriculumOptions.filter(option => option.scheme_name.trim().toLowerCase() === scheme.trim().toLowerCase());

  let curriculum: (typeof curriculumOptions)[number] | undefined;
  let curriculumResolutionReason = "EXPLICIT_INSTITUTION_PREFIX_RULE";

  if (requestedCurriculumId) {
    curriculum = allowedOptions.find(option => option.id === requestedCurriculumId);
    if (!curriculum) {
      return {
        ...unresolved("CURRICULUM", parsed.prefix === "BT"
          ? "The selected curriculum is not an eligible legacy curriculum for this institution, programme and branch."
          : "The selected curriculum does not belong to the detected institution, programme and branch.", parsed),
        programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id,
        admissionYear: parsed.admissionYear, admissionMode: mode.mode_name, entrySemester: Number(mode.entry_semester),
        curriculumOptions: allowedOptions,
      };
    }
    curriculumResolutionReason = "STUDENT_CONFIRMED_CURRICULUM";
  } else if (parsed.prefix === "BE") {
    const candidates = configuredScheme
      ? schemeMatches(configuredScheme).filter(option => isAllowedSchemeForEnrollmentPrefix("BE", option.scheme_name))
      : allowedOptions;
    if (candidates.length !== 1) {
      return {
        ...unresolved("SCHEME", candidates.length > 1
          ? "Multiple NEW CBCS curricula match this programme and branch. Institutional mapping needs review."
          : "No unique NEW CBCS curriculum is configured for this programme and branch.", parsed),
        programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id,
        admissionYear: parsed.admissionYear, admissionMode: mode.mode_name, entrySemester: Number(mode.entry_semester),
        curriculumOptions: allowedOptions,
      };
    }
    curriculum = candidates[0];
    curriculumResolutionReason = configuredScheme ? "EXPLICIT_INSTITUTION_PREFIX_RULE" : "UNIQUE_NEW_CBCS_CURRICULUM";
  } else if (parsed.prefix === "BT") {
    // A stale global NEW CBCS rule is never allowed to shadow institution-specific legacy curricula.
    const configuredMatches = configuredScheme && !isAllowedSchemeForEnrollmentPrefix("BT", configuredScheme)
      ? [] : configuredScheme ? schemeMatches(configuredScheme).filter(option => isAllowedSchemeForEnrollmentPrefix("BT", option.scheme_name)) : [];
    const candidates = configuredMatches.length ? configuredMatches : allowedOptions;
    if (candidates.length === 1) {
      curriculum = candidates[0];
      curriculumResolutionReason = configuredMatches.length ? "EXPLICIT_INSTITUTION_PREFIX_RULE" : "UNIQUE_COMPATIBLE_LEGACY_CURRICULUM";
    } else {
      return {
        ...unresolved("SCHEME", candidates.length > 1
          ? "Multiple eligible legacy curricula exist for this programme and branch. Confirm the curriculum used by your institution."
          : "No eligible legacy curriculum exists for this programme and branch. Ask your institution administrator to configure the correct curriculum.", parsed),
        programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id,
        admissionYear: parsed.admissionYear, admissionMode: mode.mode_name, admissionModeId: mode.admission_mode_id ?? null,
        entrySemester: Number(mode.entry_semester), curriculumOptions: allowedOptions,
      };
    }
  } else {
    const configuredMatches = configuredScheme ? schemeMatches(configuredScheme) : [];
    const candidates = configuredMatches.length ? configuredMatches : curriculumOptions;
    if (candidates.length !== 1) {
      return {
        ...unresolved("CURRICULUM", candidates.length > 1
          ? "Multiple curricula match this programme and branch. Confirm the institution's configured curriculum."
          : "No curriculum is configured for this programme and branch.", parsed),
        programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id,
        admissionYear: parsed.admissionYear, admissionMode: mode.mode_name, entrySemester: Number(mode.entry_semester),
        curriculumOptions,
      };
    }
    curriculum = candidates[0];
    curriculumResolutionReason = configuredMatches.length ? "EXPLICIT_INSTITUTION_PREFIX_RULE" : "UNIQUE_INSTITUTION_CURRICULUM";
  }
  if (!curriculum) return unresolved("CURRICULUM", "No eligible curriculum could be resolved.", parsed);
  const totalSemesters = Number(curriculum.resolved_total_semesters);
  const curriculumId = curriculum.id;
  const curriculumSchemeName = curriculum.scheme_name;
  const durationYears = Number(rule.duration_years ?? totalSemesters / 2);
  if (!Number.isInteger(totalSemesters) || totalSemesters < Number(mode.entry_semester) || !Number.isFinite(durationYears) || durationYears < 1) {
    return unresolved("PROGRAMME_DURATION", "Programme duration or semester count is not configured correctly.", parsed);
  }
  const calendarResult = await pool.query(
    `SELECT academic_year_start_month, odd_semester_start_month, odd_semester_end_month, timezone, active_from, active_to
     FROM institution_academic_calendars
     WHERE institution_id = $1
     ORDER BY active_from DESC NULLS LAST`,
    [institutionId],
  );
  const calendar = (calendarResult.rows as Array<{ timezone: string | null; active_from: string | Date | null; active_to: string | Date | null; academic_year_start_month: number; odd_semester_start_month: number; odd_semester_end_month: number }>).find(row => {
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: row.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    return (!row.active_from || String(row.active_from).slice(0, 10) <= localDate) &&
      (!row.active_to || String(row.active_to).slice(0, 10) >= localDate);
  });
  if (!calendar) {
    return { ...unresolved("ACADEMIC_CALENDAR", "The institution's academic calendar is not configured for today's date.", parsed), programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id, curriculumId: curriculum.id };
  }
  const expected = predictSemester({
    admissionYear: parsed.admissionYear, entrySemester: Number(mode.entry_semester), totalSemesters,
    academicYearStartMonth: Number(calendar.academic_year_start_month),
    oddSemesterStartMonth: Number(calendar.odd_semester_start_month),
    oddSemesterEndMonth: Number(calendar.odd_semester_end_month),
    date: (() => { const parts = new Intl.DateTimeFormat('en-US', { timeZone: calendar.timezone || 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now); const part = (type: string) => Number(parts.find(p => p.type === type)?.value); return new Date(part('year'), part('month') - 1, part('day'), 12); })(),
  });
  return {
    recognized: true, requiresConfirmation: false, parsed,
    programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id,
    curriculumId, curriculumName: curriculumSchemeName, curriculumResolutionReason, schemeId: curriculum.scheme_id, schemeCode: curriculum.scheme_code, totalSemesters,
    admissionYear: parsed.admissionYear, admissionMode: mode.mode_name, admissionModeId: mode.admission_mode_id ?? null,
    entrySemester: Number(mode.entry_semester), scheme: curriculumSchemeName,
    expected,
    verified: { actualEnrolledSemester: null, academicDelay: null, gapYears: null, graduationStatus: "NOT_VERIFIED" },
  };
}
