import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

async function resolveProfile(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser?.uid) { res.status(401).json({ success: false, message: "User is not authenticated." }); return null; }
  const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
  if (!user) { res.status(404).json({ success: false, message: "Gradly user account was not found." }); return null; }
  const result = await pool.query(
    `SELECT curriculum_id FROM public.student_profiles WHERE user_id = $1 AND academic_profile_confirmed IS TRUE LIMIT 1`,
    [user.id],
  );
  if (!result.rows[0]?.curriculum_id) { res.status(409).json({ success: false, message: "Confirm your academic profile before registering discovered subjects." }); return null; }
  return { userId: user.id, curriculumId: String(result.rows[0].curriculum_id) };
}

export async function listDiscoveredResultSubjects(req: AuthenticatedRequest, res: Response) {
  try {
    const profile = await resolveProfile(req, res); if (!profile) return;
    const curriculumId = String(req.query.curriculumId || "");
    if (curriculumId !== profile.curriculumId) return res.status(403).json({ success: false, message: "The requested curriculum does not match your confirmed academic profile." });
    const codes = String(req.query.codes || "").split(",").map(value => value.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean).slice(0, 100);
    const semesterNumber = Number(req.query.semesterNumber);
    const hasSemester = Number.isInteger(semesterNumber) && semesterNumber >= 1 && semesterNumber <= 12;
    if (!codes.length && !hasSemester) return res.json({ success: true, data: [] });

    const selected = await pool.query(
      `SELECT id, institution_id, program_id, scheme_id
       FROM public.curricula WHERE id = $1 LIMIT 1`,
      [curriculumId],
    );
    if (!selected.rows.length) return res.status(404).json({ success: false, message: "Selected curriculum was not found." });
    const selectedCurriculum = selected.rows[0];

    // The student app must resolve the same institution-wide subject catalogue
    // as Tester mode. Published discoveries are promoted into curriculum_subjects,
    // so looking only in discovered_result_subjects makes those courses look new
    // again after publication (and when they were published under another branch).
    const result = codes.length
      ? await pool.query(
          `WITH candidates AS (
             SELECT cs.course_code AS "courseCode", cs.course_name AS "courseName",
                    cs.credits, cs.course_type AS "courseCategory",
                    NULL::text AS "creditStatus", sem.semester_number AS "semesterNumber",
                    CASE WHEN c.id = $3::uuid THEN 1
                         WHEN c.program_id = $4 AND c.scheme_id IS NOT DISTINCT FROM $5 THEN 2
                         ELSE 3 END AS priority
             FROM public.curriculum_subjects cs
             JOIN public.semesters sem ON sem.id = cs.semester_id
             JOIN public.curricula c ON c.id = cs.curriculum_id
             WHERE c.institution_id = $1
               AND regexp_replace(upper(cs.course_code),'[^A-Z0-9]','','g') = ANY($2::text[])
             UNION ALL
             SELECT drs.course_code AS "courseCode", drs.course_name AS "courseName",
                    drs.credits, drs.course_category AS "courseCategory",
                    drs.credit_status AS "creditStatus", drs.semester_number AS "semesterNumber",
                    CASE WHEN drs.curriculum_id = $3::uuid THEN 4
                         WHEN c.program_id = $4 AND c.scheme_id IS NOT DISTINCT FROM $5 THEN 5
                         ELSE 6 END AS priority
             FROM public.discovered_result_subjects drs
             JOIN public.curricula c ON c.id = drs.curriculum_id
             WHERE c.institution_id = $1
               AND regexp_replace(upper(drs.course_code),'[^A-Z0-9]','','g') = ANY($2::text[])
             UNION ALL
             SELECT s.canonical_code AS "courseCode", s.canonical_name AS "courseName",
                    NULL::numeric AS credits, NULL::text AS "courseCategory",
                    NULL::text AS "creditStatus", NULL::integer AS "semesterNumber", 7 AS priority
             FROM public.subjects s
             WHERE s.institution_id = $1
               AND regexp_replace(upper(s.canonical_code),'[^A-Z0-9]','','g') = ANY($2::text[])
           )
           SELECT DISTINCT ON (regexp_replace(upper("courseCode"),'[^A-Z0-9]','','g'))
                  "courseCode", "courseName", credits, "courseCategory", "creditStatus", "semesterNumber"
           FROM candidates
           ORDER BY regexp_replace(upper("courseCode"),'[^A-Z0-9]','','g'), priority ASC, "courseName" ASC`,
          [selectedCurriculum.institution_id, codes, curriculumId, selectedCurriculum.program_id, selectedCurriculum.scheme_id],
        )
      : await pool.query(
          `WITH candidates AS (
             SELECT cs.course_code AS "courseCode", cs.course_name AS "courseName",
                    cs.credits, cs.course_type AS "courseCategory",
                    NULL::text AS "creditStatus", sem.semester_number AS "semesterNumber",
                    CASE WHEN c.id = $3::uuid THEN 1 ELSE 2 END AS priority
             FROM public.curriculum_subjects cs
             JOIN public.semesters sem ON sem.id = cs.semester_id
             JOIN public.curricula c ON c.id = cs.curriculum_id
             WHERE c.institution_id = $1
               AND (c.id = $3::uuid OR (c.program_id = $4 AND c.scheme_id IS NOT DISTINCT FROM $5))
               AND sem.semester_number = $2
             UNION ALL
             SELECT drs.course_code AS "courseCode", drs.course_name AS "courseName",
                    drs.credits, drs.course_category AS "courseCategory",
                    drs.credit_status AS "creditStatus", drs.semester_number AS "semesterNumber",
                    CASE WHEN drs.curriculum_id = $3::uuid THEN 3 ELSE 4 END AS priority
             FROM public.discovered_result_subjects drs
             JOIN public.curricula c ON c.id = drs.curriculum_id
             WHERE c.institution_id = $1
               AND (c.id = $3::uuid OR (c.program_id = $4 AND c.scheme_id IS NOT DISTINCT FROM $5))
               AND drs.semester_number = $2
           )
           SELECT DISTINCT ON (regexp_replace(upper("courseCode"),'[^A-Z0-9]','','g'))
                  "courseCode", "courseName", credits, "courseCategory", "creditStatus", "semesterNumber"
           FROM candidates
           ORDER BY regexp_replace(upper("courseCode"),'[^A-Z0-9]','','g'), priority ASC, "courseName" ASC`,
          [selectedCurriculum.institution_id, semesterNumber, curriculumId, selectedCurriculum.program_id, selectedCurriculum.scheme_id],
        );
    return res.json({ success: true, data: result.rows, sharedCatalogue: true, catalogueScope: "INSTITUTION" });
  } catch (error) {
    console.error("Discovered result subject lookup failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load the discovered subject catalogue." });
  }
}

export async function confirmDiscoveredResultSubject(req: AuthenticatedRequest, res: Response) {
  try {
    const profile = await resolveProfile(req, res); if (!profile) return;
    const curriculumId = String(req.body?.curriculumId || "");
    const courseCode = String(req.body?.courseCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const courseName = String(req.body?.courseName || "").trim().slice(0, 180);
    const requestedCategory = String(req.body?.courseCategory || "UNCLASSIFIED").toUpperCase().slice(0, 24);
    const inferredCategory = courseCode.startsWith("ETHS") ? "HSSM"
      : courseCode.startsWith("CEOE") ? "OE"
      : courseCode.startsWith("ITPC") ? "PCC"
      : courseCode.startsWith("ITPE") ? "PEC"
      : courseCode.startsWith("ITES") ? "ESC"
      : courseCode.startsWith("MABS") ? "BSC"
      : courseCode.startsWith("ITHS") ? "AEC"
      : courseCode.startsWith("INHS") ? "VEC"
      : courseCode.startsWith("ITMD") ? "MDM"
      : "UNCLASSIFIED";
    const courseCategory = requestedCategory === "UNCLASSIFIED" ? inferredCategory : requestedCategory;
    const credits = Number(req.body?.credits);
    const semesterNumber = Number(req.body?.semesterNumber);
    if (curriculumId !== profile.curriculumId) return res.status(403).json({ success: false, message: "The requested curriculum does not match your confirmed academic profile." });
    if (!/^[A-Z0-9]{4,16}$/.test(courseCode) || courseName.length < 2 || !Number.isFinite(credits) || credits < 0 || credits > 30 || !Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12) {
      return res.status(400).json({ success: false, message: "Enter a valid course code, subject name, semester and credit value." });
    }
    const inserted = await pool.query(
      `INSERT INTO public.discovered_result_subjects
        (curriculum_id, course_code, course_name, course_category, credits, credit_status, confirmed_by, source, semester_number)
       VALUES ($1,$2,$3,$4,$5,'FIRST_USER_CONFIRMED',$6,$7,$8)
       ON CONFLICT (curriculum_id, course_code) DO NOTHING
       RETURNING course_code AS "courseCode", course_name AS "courseName", course_category AS "courseCategory", credits, credit_status AS "creditStatus"`,
      [curriculumId, courseCode, courseName, courseCategory, credits, profile.userId, String(req.body?.source || "RESULT_PDF").slice(0, 80), semesterNumber],
    );
    const row = inserted.rows[0] || (await pool.query(
      `SELECT course_code AS "courseCode", course_name AS "courseName", course_category AS "courseCategory", credits, credit_status AS "creditStatus"
       FROM public.discovered_result_subjects WHERE curriculum_id=$1 AND course_code=$2 LIMIT 1`,
      [curriculumId, courseCode],
    )).rows[0];
    return res.status(inserted.rowCount ? 201 : 200).json({ success: true, created: Boolean(inserted.rowCount), data: row });
  } catch (error) {
    console.error("Discovered result subject registration failed:", error);
    return res.status(500).json({ success: false, message: "Unable to register the discovered subject." });
  }
}
