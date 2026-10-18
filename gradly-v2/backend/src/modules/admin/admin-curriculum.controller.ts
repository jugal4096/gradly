import type { Response } from "express";
import { pool } from "../../config/database";
import type { AdminAuthenticatedRequest } from "../../middleware/admin-auth.middleware";

export async function listAdminCurriculum(req: AdminAuthenticatedRequest, res: Response) {
  const admin = req.admin;
  if (!admin?.adminId || !admin.institutionId || !admin.programId || !admin.branchId) {
    return res.status(401).json({ success: false, message: "Admin identity, program, or department assignment is missing. Ask Super Admin to complete your assignment." });
  }

  try {
    const result = await pool.query(
      `SELECT
         cs.id,
         cs.course_code AS code,
         cs.course_name AS name,
         cs.credits,
         cs.course_type AS "courseType",
         cs.mandatory,
         cs.elective_group AS "electiveGroup",
         cs.active AS "courseActive",
         sem.semester_number AS semester,
         sem.name AS "semesterName",
         sem.expected_credits AS "expectedSemesterCredits",
         c.id AS "curriculumId",
         c.version AS "curriculumVersion",
         c.status AS "curriculumStatus",
         c.total_semesters AS "totalSemesters",
         c.total_credits AS "curriculumCredits",
         b.name AS branch,
         b.code AS "branchCode",
         sc.name AS scheme,
         sc.code AS "schemeCode",
         p.name AS program,
         p.level AS "programLevel",
         i.name AS institution,
         COALESCE(to_jsonb(ay)->>'name', to_jsonb(ay)->>'label', to_jsonb(ay)->>'year', to_jsonb(ay)->>'academic_year', to_jsonb(ay)->>'code') AS "academicYear",
         COALESCE(to_jsonb(gs)->>'name', to_jsonb(gs)->>'label', to_jsonb(gs)->>'code', to_jsonb(gs)->>'system_name') AS "gradingSystem"
       FROM public.curriculum_subjects cs
       JOIN public.curricula c ON c.id = cs.curriculum_id
       JOIN public.semesters sem ON sem.id = cs.semester_id
       LEFT JOIN public.branches b ON b.id = c.branch_id
       LEFT JOIN public.schemes sc ON sc.id = c.scheme_id
       LEFT JOIN public.programs p ON p.id = c.program_id
       LEFT JOIN public.institutions i ON i.id = c.institution_id
       LEFT JOIN public.academic_years ay ON ay.id = c.academic_year_id
       LEFT JOIN public.grading_systems gs ON gs.id = c.grading_system_id
       WHERE c.institution_id = $1
         AND c.branch_id = $2::uuid
         AND c.program_id = $3::uuid
       ORDER BY p.name, b.name, sc.name, sem.semester_number, cs.course_code
       LIMIT 5000`,
      [admin.institutionId, admin.branchId || null, admin.programId || null]
    );

    return res.status(200).json({ success: true, curriculum: result.rows, count: result.rows.length, limit: 5000 });
  } catch (error) {
    console.error("Failed to load institution curriculum:", error);
    return res.status(500).json({ success: false, message: "Unable to load curriculum for your assigned institution." });
  }
}
