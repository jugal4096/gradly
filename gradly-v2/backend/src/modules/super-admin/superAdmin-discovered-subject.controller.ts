import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

const textValue = (value: unknown) => String(value ?? "").trim();

export async function updateDiscoveredSubject(req: SuperAdminAuthenticatedRequest, res: Response) {
  const id = textValue(req.params.id);
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const allowed = ["courseCode", "courseName", "courseCategory", "credits", "semesterNumber", "curriculumId", "source", "creditStatus"] as const;
  const provided = allowed.filter(key => Object.prototype.hasOwnProperty.call(body, key));
  if (!id || !provided.length) return res.status(400).json({ success:false, message:"A discovered subject ID and at least one editable field are required." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT * FROM public.discovered_result_subjects WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({success:false,message:"Discovered subject not found."}); }
    const row = current.rows[0];
    if (row.publication_status === "PUBLISHED") { await client.query("ROLLBACK"); return res.status(409).json({success:false,message:"This subject is already published. Edit the official curriculum record instead."}); }
    const next = {
      course_code: Object.prototype.hasOwnProperty.call(body,"courseCode") ? textValue(body.courseCode) : row.course_code,
      course_name: Object.prototype.hasOwnProperty.call(body,"courseName") ? textValue(body.courseName) : row.course_name,
      course_category: Object.prototype.hasOwnProperty.call(body,"courseCategory") ? textValue(body.courseCategory) : row.course_category,
      credits: Object.prototype.hasOwnProperty.call(body,"credits") ? Number(body.credits) : Number(row.credits),
      semester_number: Object.prototype.hasOwnProperty.call(body,"semesterNumber") ? Number(body.semesterNumber) : Number(row.semester_number),
      curriculum_id: Object.prototype.hasOwnProperty.call(body,"curriculumId") ? textValue(body.curriculumId) : row.curriculum_id,
      source: Object.prototype.hasOwnProperty.call(body,"source") ? textValue(body.source) : row.source,
      credit_status: Object.prototype.hasOwnProperty.call(body,"creditStatus") ? textValue(body.creditStatus) : row.credit_status,
    };
    if (!next.course_code || !next.course_name || !next.course_category || !next.source) throw new Error("Course code, name, category and source are required.");
    if (!Number.isFinite(next.credits) || next.credits < 0 || next.credits > 30) throw new Error("Credits must be between 0 and 30.");
    if (!Number.isInteger(next.semester_number) || next.semester_number < 1 || next.semester_number > 12) throw new Error("Semester must be a whole number from 1 to 12.");
    if (!["FIRST_USER_CONFIRMED","SUPER_ADMIN_VERIFIED"].includes(next.credit_status)) throw new Error("Invalid credit verification status.");
    const curriculum = await client.query("SELECT id FROM public.curricula WHERE id=$1", [next.curriculum_id]);
    if (!curriculum.rowCount) throw new Error("Selected curriculum was not found.");
    const semester = await client.query("SELECT id FROM public.semesters WHERE curriculum_id=$1 AND semester_number=$2", [next.curriculum_id,next.semester_number]);
    if (!semester.rowCount) throw new Error("The selected curriculum does not contain that semester.");
    const updated = await client.query(
      `UPDATE public.discovered_result_subjects
          SET course_code=$1, course_name=$2, course_category=$3, credits=$4,
              semester_number=$5, curriculum_id=$6, source=$7, credit_status=$8,
              updated_at=now()
        WHERE id=$9 RETURNING *`,
      [next.course_code,next.course_name,next.course_category,next.credits,next.semester_number,next.curriculum_id,next.source,next.credit_status,id]
    );
    await client.query("COMMIT");
    return res.json({success:true,message:"Discovered catalogue entry updated.",data:updated.rows[0]});
  } catch (error) {
    await client.query("ROLLBACK").catch(()=>undefined);
    const message = error instanceof Error ? error.message : "Could not update discovered subject.";
    return res.status(400).json({success:false,message});
  } finally { client.release(); }
}

export async function publishDiscoveredSubject(req: SuperAdminAuthenticatedRequest, res: Response) {
  const id = textValue(req.params.id);
  if (!id) return res.status(400).json({success:false,message:"A discovered subject ID is required."});
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT d.*, c.institution_id
         FROM public.discovered_result_subjects d
         JOIN public.curricula c ON c.id=d.curriculum_id
        WHERE d.id=$1 FOR UPDATE OF d`, [id]
    );
    if (!found.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({success:false,message:"Discovered subject not found."}); }
    const d = found.rows[0];
    if (d.publication_status === "PUBLISHED" && d.published_curriculum_subject_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({success:false,message:"This subject is already published."});
    }
    const semester = await client.query("SELECT id FROM public.semesters WHERE curriculum_id=$1 AND semester_number=$2", [d.curriculum_id,d.semester_number]);
    if (!semester.rowCount) throw new Error("No matching semester exists in the selected curriculum.");
    const subject = await client.query(
      `INSERT INTO public.subjects (institution_id, canonical_code, canonical_name, active)
       VALUES ($1,$2,$3,true)
       ON CONFLICT (institution_id, canonical_code, canonical_name)
       DO UPDATE SET active=true, updated_at=now()
       RETURNING id`,
      [d.institution_id,d.course_code,d.course_name]
    );
    const mapping = await client.query(
      `INSERT INTO public.curriculum_subjects
        (curriculum_id, semester_id, subject_id, course_code, course_name, credits, course_type, mandatory, active, course_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false,true,$4)
       ON CONFLICT (curriculum_id, semester_id, course_code)
       DO UPDATE SET subject_id=EXCLUDED.subject_id, course_name=EXCLUDED.course_name,
                     credits=EXCLUDED.credits, course_type=EXCLUDED.course_type,
                     active=true, updated_at=now()
       RETURNING id`,
      [d.curriculum_id,semester.rows[0].id,subject.rows[0].id,d.course_code,d.course_name,d.credits,d.course_category]
    );
    await client.query(
      `UPDATE public.discovered_result_subjects
          SET publication_status='PUBLISHED', credit_status='SUPER_ADMIN_VERIFIED',
              published_at=now(), published_curriculum_subject_id=$1, updated_at=now()
        WHERE id=$2`, [mapping.rows[0].id,id]
    );
    await client.query("COMMIT");
    return res.json({success:true,message:"Subject published to the official curriculum.",curriculumSubjectId:mapping.rows[0].id});
  } catch (error) {
    await client.query("ROLLBACK").catch(()=>undefined);
    const message = error instanceof Error ? error.message : "Could not publish discovered subject.";
    return res.status(400).json({success:false,message});
  } finally { client.release(); }
}
