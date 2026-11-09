-- BT enrollment numbers are a distinct legacy prefix and must never inherit NEW CBCS.
-- Preserve any institution-specific BT mapping to a different, explicitly named scheme.
BEGIN;

UPDATE public.enrollment_program_rules
SET scheme_label = NULL
WHERE prefix = 'BT'
  AND scheme_label IS NOT NULL
  AND lower(regexp_replace(trim(scheme_label), '[[:space:]]+', ' ', 'g')) = 'new cbcs';

COMMIT;

-- Review available institutional BT curricula and configure the verified scheme_label:
-- SELECT i.name AS institution, p.name AS programme, b.name AS branch,
--        sc.id AS scheme_id, sc.code AS scheme_code, sc.name AS scheme_name,
--        c.id AS curriculum_id, c.total_semesters, c.version, c.status
-- FROM public.curricula c
-- JOIN public.institutions i ON i.id = c.institution_id
-- JOIN public.programs p ON p.id = c.program_id
-- JOIN public.branches b ON b.id = c.branch_id
-- JOIN public.schemes sc ON sc.id = c.scheme_id
-- WHERE p.name ILIKE '%Bachelor of Technology%'
-- ORDER BY i.name, b.name, sc.name, c.version DESC;
