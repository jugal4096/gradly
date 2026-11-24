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
    const result = codes.length
      ? await pool.query(
          `WITH selected AS (
             SELECT institution_id FROM public.curricula WHERE id=$1
           ), candidates AS (
             SELECT d.course_code AS "courseCode", d.course_name AS "courseName", d.course_category AS "courseCategory",
                    d.credits, d.credit_status AS "creditStatus", d.semester_number AS "semesterNumber", 1 AS priority
             FROM public.discovered_result_subjects d
             JOIN public.curricula c ON c.id=d.curriculum_id
             WHERE c.institution_id=(SELECT institution_id FROM selected)
               AND EXISTS (
                 SELECT 1 FROM regexp_split_to_table(upper(d.course_code), '[^A-Z0-9]+') AS parts(code_part)
                 WHERE regexp_replace(parts.code_part,'[^A-Z0-9]','','g')=ANY($2::text[])
               )
             UNION ALL
             SELECT cs.course_code, cs.course_name, cs.course_type, cs.credits, 'CURRICULUM', sem.semester_number, 2
             FROM public.curriculum_subjects cs
             JOIN public.curricula c ON c.id=cs.curriculum_id
             LEFT JOIN public.semesters sem ON sem.id=cs.semester_id
             WHERE c.institution_id=(SELECT institution_id FROM selected)
               AND EXISTS (
                 SELECT 1 FROM regexp_split_to_table(upper(cs.course_code), '[^A-Z0-9]+') AS parts(code_part)
                 WHERE regexp_replace(parts.code_part,'[^A-Z0-9]','','g')=ANY($2::text[])
               )
             UNION ALL
             SELECT s.canonical_code, s.canonical_name, 'UNCLASSIFIED', NULL::numeric, 'CANONICAL', NULL::integer, 3
             FROM public.subjects s
             WHERE s.institution_id=(SELECT institution_id FROM selected)
               AND regexp_replace(upper(s.canonical_code),'[^A-Z0-9]','','g')=ANY($2::text[])
           )
           SELECT DISTINCT ON (regexp_replace(upper("courseCode"),'[^A-Z0-9]','','g'))
                  "courseCode","courseName","courseCategory",credits,"creditStatus","semesterNumber"
           FROM candidates
           ORDER BY regexp_replace(upper("courseCode"),'[^A-Z0-9]','','g'), priority`,
          [curriculumId, codes],
        )
      : await pool.query(
          `SELECT course_code AS "courseCode", course_name AS "courseName", course_category AS "courseCategory", credits, credit_status AS "creditStatus", semester_number AS "semesterNumber"
           FROM public.discovered_result_subjects WHERE curriculum_id = $1 AND semester_number = $2 ORDER BY course_code`,
          [curriculumId, semesterNumber],
        );
    return res.json({ success: true, data: result.rows });
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
