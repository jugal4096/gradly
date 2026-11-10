import { pool } from "../../config/database";

import { enrollmentBranchMatches, isAllowedSchemeForEnrollmentPrefix, parseEnrollmentNumber, predictSemester, programmeMatchesEnrollmentPrefix, resolveEnrollmentBranchCode } from "./enrollment-progression";
export { parseEnrollmentNumber, predictSemester } from "./enrollment-progression";
import type { EnrollmentComponents } from "./enrollment-progression";

const unresolved = (reason: string, message: string, parsed: EnrollmentComponents) =>
  ({ recognized: false, requiresConfirmation: true, unknown: reason, message, parsed });

export async function previewEnrollment(institutionId: string, rawEnrollmentNumber: string, now = new Date(), requestedCurriculumId?: string) {
  const initial = parseEnrollmentNumber(rawEnrollmentNumber, 70, now);
  const rules = await pool.query(
    `SELECT prefix, programme_name_pattern, programme_alternate_pattern, programme_alias_patterns, scheme_label, duration_years, total_semesters, year_pivot_start
     FROM enrollment_program_rules
     WHERE institution_id = $1 OR institution_id IS NULL
     ORDER BY (institution_id = $1) DESC NULLS LAST`, [institutionId],
  );
  const configuredRule = (rules.rows as Array<{ prefix: string; programme_name_pattern: string; programme_alternate_pattern: string | null; programme_alias_patterns: string[]; scheme_label: string | null; duration_years: number | null; total_semesters: number | null; year_pivot_start: number | null }>).find(row => row.prefix === initial.prefix);
  const rule = configuredRule ?? (initial.prefix === "ME" || initial.prefix === "MT" || initial.prefix === "MC" ? {
    prefix: initial.prefix, programme_name_pattern: "", programme_alternate_pattern: null, programme_alias_patterns: [],
    scheme_label: initial.prefix === "ME" ? "New CBCS" : initial.prefix === "MT" ? "NEP" : null, duration_years: null, total_semesters: null, year_pivot_start: 70,
  } : null);
  if (!rule) return unresolved("PROGRAMME_PREFIX", "This programme prefix is not configured for your institution.", initial);
  const parsed = parseEnrollmentNumber(rawEnrollmentNumber, Number(rule.year_pivot_start ?? 70), now);

  // Resolve programme candidates from the parsed degree prefix first. Rule-table
  // name patterns may be stale or overlapping, so they must never select a conflicting degree.
  const programDirectory = await pool.query(
    `SELECT id, name, level FROM programs WHERE institution_id = $1 ORDER BY name`,
    [institutionId],
  );
  const matchingPrograms = programDirectory.rows.filter((candidate: { name?: string | null }) =>
    programmeMatchesEnrollmentPrefix(parsed.prefix, String(candidate.name ?? "")),
  );
  if (matchingPrograms.length !== 1) {
    return unresolved("PROGRAMME", matchingPrograms.length
      ? "Multiple programmes match the degree prefix in this institution's directory. Institutional programme records need review."
      : "No programme in this institution's directory matches the degree prefix in the enrollment number.", parsed);
  }
  const program = matchingPrograms[0];

  const institutionResult = await pool.query(`SELECT name FROM institutions WHERE id = $1 LIMIT 1`, [institutionId]);
  const institutionName = String(institutionResult.rows[0]?.name ?? "");
  const decodedBranchName = resolveEnrollmentBranchCode(institutionName, parsed.prefix, parsed.branchCode);
  // ME codes are institution-specific: resolve only an exact code already stored in the
  // institution branch directory. MT uses the explicitly supplied GECA specialization map.
  if (!decodedBranchName && parsed.prefix !== "ME" && parsed.prefix !== "MT" && parsed.prefix !== "MC") {
    return unresolved("BRANCH_CODE", "This branch code is not supported by the built-in enrollment decoder for this institution. Select the branch manually or request an enrollment mapping review.", parsed);
  }

  // Resolve against the institution's branch directory even when a curriculum is
  // missing. A missing NEP curriculum must be reported as a curriculum configuration
  // issue, not misclassified as an unrecognized enrollment branch code.
  const branchDirectory = await pool.query(
    `SELECT DISTINCT b.id, b.name, b.code,
            sp.id AS specialization_id, sp.name AS specialization_name, sp.code AS specialization_code
     FROM branches b
     LEFT JOIN specializations sp
       ON $2::boolean = TRUE
      AND sp.program_id = b.program_id
      AND sp.branch_id = b.id
      AND COALESCE(sp.active, TRUE) = TRUE
     WHERE b.program_id = $1
     ORDER BY b.name, sp.name`,
    [program.id, parsed.prefix === "MT"],
  );

  // Institution-configured enrollment codes are the source of truth for
  // MCA/M.E. streams; they are intentionally not inferred from unrelated codes.
  const configuredBranchCode = await pool.query(
    `SELECT branch_name
     FROM enrollment_branch_codes
     WHERE BTRIM(branch_code) = $1
       AND (institution_id = $2 OR institution_id IS NULL)
       AND (programme_prefix = $3 OR programme_prefix IS NULL)
     ORDER BY (institution_id = $2) DESC NULLS LAST,
              (programme_prefix = $3) DESC NULLS LAST
     LIMIT 1`,
    [parsed.branchCode, institutionId, parsed.prefix],
  );
  const configuredBranchName = String(configuredBranchCode.rows[0]?.branch_name ?? "").trim();
  const resolvedBranchName = decodedBranchName || configuredBranchName;
  let matchedBranches = branchDirectory.rows.filter((candidate: {
    id: string; name: string; code?: string | null;
    specialization_id?: string | null; specialization_name?: string | null; specialization_code?: string | null;
  }) => {
    if (parsed.prefix === "ME" || parsed.prefix === "MC") {
      if (configuredBranchName) {
        return enrollmentBranchMatches(parsed.prefix, configuredBranchName, {
          name: candidate.name, code: candidate.code ?? null,
        });
      }
      return String(candidate.code ?? "").trim().toUpperCase() === parsed.branchCode;
    }
    return Boolean(resolvedBranchName && enrollmentBranchMatches(parsed.prefix, resolvedBranchName, {
      name: candidate.name,
      code: candidate.code ?? null,
      specializationName: candidate.specialization_name ?? null,
      specializationCode: candidate.specialization_code ?? null,
    }));
  });

  // M.Tech enrollment codes identify a specialization, not merely its parent department.
  // Never silently downgrade a missing specialization mapping to a branch-only match.
  let uniqueBranches = Array.from(new Map(matchedBranches.map((candidate: { id: string; specialization_id?: string | null }) =>
    [`${candidate.id}:${candidate.specialization_id ?? ""}`, candidate],
  )).values());

  // MCA programmes at this institution may have a single academic branch and
  // encode a campus/course identifier in the two-digit slot. In that case,
  // resolve the sole configured branch rather than requiring a fabricated map.
  if (parsed.prefix === "MC" && uniqueBranches.length === 0) {
    const distinctBranches = Array.from(new Map(branchDirectory.rows.map((candidate: { id: string }) => [candidate.id, candidate])).values());
    if (distinctBranches.length === 1) uniqueBranches = [distinctBranches[0]];
  }
  if (uniqueBranches.length !== 1) {
    return unresolved(
      parsed.prefix === "MT" && uniqueBranches.length === 0 ? "SPECIALIZATION" : "BRANCH",
      uniqueBranches.length
        ? "More than one branch matches this enrollment code under the detected programme. Institutional mapping needs review."
        : parsed.prefix === "MT" ? "The M.Tech specialization code is not configured for this institution and department." : "Unrecognized branch code. Please verify your enrollment number.",
      parsed,
    );
  }
  const branch = uniqueBranches[0];
  if (parsed.prefix === "MT" && (!branch.specialization_id || !String(branch.specialization_name ?? "").trim())) {
    return unresolved("SPECIALIZATION", "The M.Tech specialization encoded in this enrollment number is not configured for the detected department. Ask your institution administrator to configure the specialization mapping.", parsed);
  }

  const modeResult = await pool.query(
    `SELECT em.mode_code, em.mode_name, em.entry_semester, am.id AS admission_mode_id
     FROM enrollment_admission_modes em
     LEFT JOIN admission_modes am ON LOWER(am.name) = LOWER(em.mode_name)
     WHERE (UPPER(BTRIM(em.mode_code)) = $1 OR ($1 = 'F' AND LOWER(BTRIM(em.mode_name)) IN ('regular','first year','fy')) OR ($1 = 'S' AND LOWER(BTRIM(em.mode_name)) IN ('direct second year','dsy','dse','lateral entry'))) AND (em.institution_id = $2 OR em.institution_id IS NULL)
       AND (em.programme_prefix = $3 OR em.programme_prefix IS NULL)
     ORDER BY (em.institution_id = $2) DESC NULLS LAST, (em.programme_prefix = $3) DESC NULLS LAST LIMIT 1`,
    [parsed.admissionModeCode, institutionId, parsed.prefix],
  );
  let mode = modeResult.rows[0];
  if (!mode && (parsed.prefix === "BE" || parsed.prefix === "BT") && (parsed.admissionModeCode === "F" || parsed.admissionModeCode === "S")) {
    const fallback = await pool.query(
      `SELECT id AS admission_mode_id, name AS mode_name, $1::text AS mode_code, $2::int AS entry_semester
       FROM admission_modes
       WHERE LOWER(BTRIM(name)) = ANY($3::text[])
       ORDER BY CASE WHEN LOWER(BTRIM(name)) = $4 THEN 0 ELSE 1 END LIMIT 1`,
      [parsed.admissionModeCode, parsed.admissionModeCode === "F" ? 1 : 3,
       parsed.admissionModeCode === "F" ? ["regular", "regular admission", "first year", "first year admission", "fy"] : ["direct second year", "direct second year admission", "dsy", "dse", "lateral entry"],
       parsed.admissionModeCode === "F" ? "regular" : "direct second year"],
    );
    mode = fallback.rows[0];
  }
  if (!mode && (parsed.prefix === "ME" || parsed.prefix === "MT" || parsed.prefix === "MC") && parsed.admissionModeCode === "F") {
    // Postgraduate enrollment rules already restrict ME/MT to Regular, Semester-1
    // entry. Do not make that institutional rule depend on a legacy lookup-table row.
    const regularMode = await pool.query(
      `SELECT id AS admission_mode_id, 'F' AS mode_code, name AS mode_name, 1 AS entry_semester
       FROM admission_modes
       WHERE LOWER(BTRIM(name)) = ANY(ARRAY['regular','regular admission','first year','first year admission','fy']::text[])
       ORDER BY CASE WHEN LOWER(BTRIM(name)) = 'regular admission' THEN 0
                     WHEN LOWER(BTRIM(name)) = 'regular' THEN 1 ELSE 2 END
       LIMIT 1`,
    );
    mode = regularMode.rows[0] ?? {
      admission_mode_id: null,
      mode_code: "F",
      mode_name: "Regular Admission",
      entry_semester: 1,
    };
  }
  if (!mode) return unresolved("ADMISSION_MODE", "This admission-mode code is not configured for the detected programme.", parsed);
  if ((parsed.prefix === "ME" || parsed.prefix === "MT") && (parsed.admissionModeCode !== "F" || Number(mode.entry_semester) !== 1 || !/regular/i.test(String(mode.mode_name)))) {
    return unresolved("ADMISSION_MODE", "M.E. and M.Tech. admissions must be Regular first-year entry in Semester 1.", parsed);
  }

  const curriculumOptionsResult = await pool.query(
    `SELECT c.id, c.scheme_id, sc.name AS scheme_name, sc.code AS scheme_code,
            c.version, c.total_semesters,
            COALESCE(c.total_semesters, COUNT(DISTINCT sem.semester_number)::int) AS resolved_total_semesters,
            COALESCE(c.total_semesters, COUNT(DISTINCT sem.semester_number)::int) AS configured_semesters
     FROM curricula c
     JOIN schemes sc ON sc.id = c.scheme_id
     LEFT JOIN semesters sem ON sem.curriculum_id = c.id
     WHERE c.institution_id = $1 AND c.program_id = $2 AND c.branch_id = $3
       AND ($4::boolean = FALSE OR c.specialization_id IS NOT DISTINCT FROM $5::uuid)
     GROUP BY c.id, sc.name, sc.code
     ORDER BY sc.name, c.version DESC NULLS LAST`,
    [institutionId, program.id, branch.id, parsed.prefix === "MT", branch.specialization_id ?? null],
  );
  const curriculumOptions = curriculumOptionsResult.rows as Array<{
    id: string; scheme_id: string; scheme_name: string; scheme_code: string | null;
    version: string | number | null; total_semesters: number | null; resolved_total_semesters: number;
  }>;
  const configuredScheme = String(rule.scheme_label ?? "").trim();
  const allowedOptions = curriculumOptions.filter(option => isAllowedSchemeForEnrollmentPrefix(parsed.prefix, option.scheme_name));
  const schemeMatches = (scheme: string) => curriculumOptions.filter(option => option.scheme_name.trim().toLowerCase() === scheme.trim().toLowerCase());

  let curriculum: (typeof curriculumOptions)[number] | undefined;
  let curriculumResolutionReason: string;

  if (requestedCurriculumId) {
    curriculum = allowedOptions.find(option => option.id === requestedCurriculumId);
    if (!curriculum) {
      return {
        ...unresolved("CURRICULUM", parsed.prefix === "BT"
          ? "The selected curriculum is not an eligible NEP curriculum for this institution, programme and branch."
          : "The selected curriculum does not belong to the detected institution, programme and branch.", parsed),
        programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id,
        admissionYear: parsed.admissionYear, admissionMode: mode.mode_name, entrySemester: Number(mode.entry_semester),
        curriculumOptions: allowedOptions,
      };
    }
    curriculumResolutionReason = "STUDENT_CONFIRMED_CURRICULUM";
  } else if (parsed.prefix === "BE" || parsed.prefix === "ME") {
    const candidates = allowedOptions;
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
    curriculumResolutionReason = "UNIQUE_NEW_CBCS_CURRICULUM";
  } else if (parsed.prefix === "BT" || parsed.prefix === "MT") {
    // BT is strictly NEP. Use an institution-specific scheme label only when it resolves to an eligible NEP curriculum.
    const configuredMatches = configuredScheme ? schemeMatches(configuredScheme).filter(option => isAllowedSchemeForEnrollmentPrefix(parsed.prefix, option.scheme_name)) : [];
    const candidates = configuredMatches.length ? configuredMatches : allowedOptions;
    if (candidates.length === 1) {
      curriculum = candidates[0];
      curriculumResolutionReason = configuredMatches.length ? "EXPLICIT_INSTITUTION_PREFIX_RULE" : "UNIQUE_NEP_CURRICULUM";
    } else {
      return {
        ...unresolved("SCHEME", candidates.length > 1
          ? "Multiple NEP curricula exist for this programme and branch. Confirm the curriculum used by your institution."
          : "No NEP curriculum exists for this programme and branch. Ask your institution administrator to configure the correct curriculum.", parsed),
        programme: program.name, programId: program.id, branch: branch.name, branchId: branch.id,
        admissionYear: parsed.admissionYear, admissionMode: mode.mode_name, admissionModeId: mode.admission_mode_id ?? null,
        entrySemester: Number(mode.entry_semester), curriculumOptions: allowedOptions,
      };
    }
  } else {
    const configuredMatches = configuredScheme ? schemeMatches(configuredScheme) : [];
    const candidates = configuredScheme ? configuredMatches : curriculumOptions;
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
    specialization: branch.specialization_name ?? null, specializationId: branch.specialization_id ?? null,
    curriculumId, curriculumName: curriculumSchemeName, curriculumResolutionReason, schemeId: curriculum.scheme_id, schemeCode: curriculum.scheme_code, totalSemesters,
    admissionYear: parsed.admissionYear, admissionMode: mode.mode_name, admissionModeId: mode.admission_mode_id ?? null,
    entrySemester: Number(mode.entry_semester), scheme: curriculumSchemeName,
    expected,
    verified: { actualEnrolledSemester: null, academicDelay: null, gapYears: null, graduationStatus: "NOT_VERIFIED" },
  };
}
