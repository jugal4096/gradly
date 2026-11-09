-- Gradly enrollment/curriculum verification for the existing Supabase project.
-- READ ONLY: run in Supabase SQL Editor. No credentials or student identifiers are selected.
BEGIN TRANSACTION READ ONLY;

-- 1) Discover academic tables and their columns.
SELECT table_schema, table_name, ordinal_position, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%institution%' OR table_name ILIKE '%program%'
    OR table_name ILIKE '%branch%' OR table_name ILIKE '%curricul%'
    OR table_name ILIKE '%scheme%' OR table_name ILIKE '%enrollment%'
    OR table_name ILIKE '%admission%' OR table_name ILIKE '%semester%'
    OR table_name ILIKE '%result_import%' OR table_name ILIKE '%student_profile%'
  )
ORDER BY table_name, ordinal_position;

-- 2) Prefix-to-programme/scheme rules, including global and institution-scoped rows.
SELECT institution_id, prefix, programme_name_pattern, programme_alternate_pattern,
       programme_alias_patterns, scheme_label, duration_years, total_semesters, year_pivot_start
FROM public.enrollment_program_rules
ORDER BY institution_id NULLS LAST, prefix;

-- 3) Branch-code mappings and admission-mode mappings.
SELECT institution_id, programme_prefix, branch_code, branch_name, program_name_pattern
FROM public.enrollment_branch_codes
ORDER BY institution_id NULLS LAST, programme_prefix NULLS LAST, branch_code;

SELECT institution_id, programme_prefix, mode_code, mode_name, entry_semester
FROM public.enrollment_admission_modes
ORDER BY institution_id NULLS LAST, programme_prefix NULLS LAST, mode_code;

-- 4) Programme, branch, scheme and curriculum relationships for GECA.
-- Uses name matching only to locate the institution; returns IDs and academic metadata,
-- not student records or personal information.
SELECT i.id AS institution_id, i.name AS institution_name,
       p.id AS program_id, p.name AS program_name, p.level AS program_level,
       b.id AS branch_id, b.name AS branch_name, b.code AS branch_code,
       c.id AS curriculum_id, c.version AS curriculum_version,
       c.total_semesters, sc.id AS scheme_id, sc.name AS scheme_name, sc.code AS scheme_code
FROM public.institutions i
JOIN public.programs p ON p.institution_id = i.id
JOIN public.branches b ON b.program_id = p.id
JOIN public.curricula c ON c.institution_id = i.id AND c.program_id = p.id AND c.branch_id = b.id
JOIN public.schemes sc ON sc.id = c.scheme_id
WHERE i.name ILIKE '%Government College of Engineering%'
  AND (p.name ILIKE '%BTech%' OR p.name ILIKE '%Bachelor of Technology%' OR p.name ILIKE '%Engineering%')
ORDER BY p.name, b.name, sc.name, c.version DESC NULLS LAST;

-- 5) Actual semester rows per curriculum (curriculum IDs only; no student data).
SELECT c.id AS curriculum_id, sc.name AS scheme_name,
       COUNT(DISTINCT sem.semester_number)::integer AS semester_rows,
       MIN(sem.semester_number) AS first_semester,
       MAX(sem.semester_number) AS last_semester
FROM public.curricula c
JOIN public.schemes sc ON sc.id = c.scheme_id
LEFT JOIN public.semesters sem ON sem.curriculum_id = c.id
WHERE c.institution_id IN (
  SELECT id FROM public.institutions WHERE name ILIKE '%Government College of Engineering%'
)
GROUP BY c.id, sc.name
ORDER BY sc.name, c.id;

-- 6) Migration history, if Supabase's standard migration ledger exists.
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 7) Historical BT/BE/MC/MT record counts only. Never return enrollment numbers.
-- Uncomment only if the named columns exist in this project's schema.
-- SELECT UPPER(LEFT(student_identifier, 2)) AS enrollment_prefix, COUNT(*) AS profile_count
-- FROM public.student_profiles
-- WHERE UPPER(LEFT(student_identifier, 2)) IN ('BE','BT','MC','MT')
-- GROUP BY UPPER(LEFT(student_identifier, 2))
-- ORDER BY enrollment_prefix;

ROLLBACK;
