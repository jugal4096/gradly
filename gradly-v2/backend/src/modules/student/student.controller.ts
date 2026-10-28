import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  createProfile,
  getStudentProfile,
} from "./student.service";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";
import { pool } from "../../config/database";

export async function getProfile(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({
        message: "User is not authenticated.",
      });
    }

    const user = await getGradlyUserByFirebaseUid(
      req.firebaseUser.uid
    );

    if (!user) {
      return res.status(404).json({
        message: "Gradly user account was not found.",
      });
    }

    const profile = await getStudentProfile(user.id);

    return res.status(200).json({
      profile,
    });
  } catch (error) {
    console.error("Failed to get student profile:", error);

    return res.status(500).json({
      message: "Failed to get student profile.",
    });
  }
}

export async function createStudentProfileController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({
        message: "User is not authenticated.",
      });
    }

    const user = await getGradlyUserByFirebaseUid(
      req.firebaseUser.uid
    );

    if (!user) {
      return res.status(404).json({
        message:
          "Gradly user account was not found. Please synchronize your account first.",
      });
    }

    const {
      institutionId,
      curriculumId,
      admissionModeId,
      studentIdentifier,
      admissionYear,
      currentSemesterNumber,
      graduationYear,
      targetCgpa,
      gapYears,
      displayName,
    } = req.body;

    if (
      !institutionId ||
      !curriculumId ||
      !studentIdentifier ||
      admissionYear === undefined ||
      currentSemesterNumber === undefined
    ) {
      return res.status(400).json({
        message: "Required student profile fields are missing.",
      });
    }

    const curriculumMatch = await pool.query("SELECT id FROM public.curricula WHERE id::text = $1 AND institution_id::text = $2 LIMIT 1", [String(curriculumId), String(institutionId)]);
    if (!curriculumMatch.rows[0]) return res.status(400).json({ message: "The selected curriculum does not belong to the selected institution." });
    const admissionYearValue = Number(admissionYear);
    const semesterValue = Number(currentSemesterNumber);
    const gapYearValue = Number(gapYears ?? 0);
    if (!Number.isInteger(admissionYearValue) || admissionYearValue < 1980 || admissionYearValue > new Date().getFullYear() + 1) {
      return res.status(400).json({ message: "Enter a valid admission year." });
    }
    if (!Number.isInteger(semesterValue) || semesterValue < 1 || semesterValue > 16) {
      return res.status(400).json({ message: "Current semester must be between 1 and 16." });
    }
    if (!Number.isInteger(gapYearValue) || gapYearValue < 0 || gapYearValue > 20) {
      return res.status(400).json({ message: "Gap years must be a whole number from 0 to 20." });
    }

    const profile = await createProfile({
      userId: user.id,
      institutionId,
      curriculumId,
      admissionModeId: admissionModeId ?? null,
      studentIdentifier,
      admissionYear: admissionYearValue,
      currentSemesterNumber: semesterValue,
      graduationYear:
        graduationYear !== undefined &&
        graduationYear !== null
          ? Number(graduationYear)
          : null,
      targetCgpa:
        targetCgpa !== undefined &&
        targetCgpa !== null
          ? Number(targetCgpa)
          : null,
      gapYears: gapYearValue,
    });

    if (typeof displayName === "string") {
      await pool.query("UPDATE public.users SET display_name = $1, updated_at = NOW() WHERE id = $2", [displayName.trim().slice(0, 120) || null, user.id]);
    }
    await pool.query(
      "INSERT INTO public.audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata) VALUES ('STUDENT', $1, 'STUDENT', 'STUDENT_PROFILE_CREATED', 'student_profiles', $2, $3::jsonb)",
      [user.id, profile.id, JSON.stringify({ source: "student_portal" })]
    );

    return res.status(201).json({
      message: "Student profile created successfully.",
      profile,
    });
  } catch (error) {
    console.error(
      "Failed to create student profile:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "Student profile already exists."
    ) {
      return res.status(409).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Failed to create student profile.",
    });
  }
}

/** Update the authenticated student's own profile only. */
export async function updateStudentProfileController(
  req: AuthenticatedRequest,
  res: Response
) {
  const client = await pool.connect();
  try {
    if (!req.firebaseUser) return res.status(401).json({ message: "User is not authenticated." });
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user) return res.status(404).json({ message: "Gradly user account was not found." });
    if (!user.active) return res.status(403).json({ message: "This account has been deactivated." });

    const {
      displayName, institutionId, curriculumId, admissionModeId, studentIdentifier,
      admissionYear, currentSemesterNumber, graduationYear, targetCgpa, gapYears,
    } = req.body ?? {};
    const existing = await client.query(
      "SELECT id FROM public.student_profiles WHERE user_id = $1 LIMIT 1",
      [user.id]
    );
    const curriculumMatch = await client.query("SELECT id FROM public.curricula WHERE id::text = $1 AND institution_id::text = $2 LIMIT 1", [String(curriculumId), String(institutionId)]);
    if (!curriculumMatch.rows[0]) return res.status(400).json({ message: "The selected curriculum does not belong to the selected institution." });
    if (!existing.rows[0]) return res.status(404).json({ message: "Student profile not found. Create your profile first." });

    const year = Number(admissionYear);
    const semester = Number(currentSemesterNumber);
    const gaps = Number(gapYears ?? 0);
    const graduation = graduationYear === "" || graduationYear == null ? null : Number(graduationYear);
    const target = targetCgpa === "" || targetCgpa == null ? null : Number(targetCgpa);
    if (!institutionId || !curriculumId || typeof studentIdentifier !== "string" || !studentIdentifier.trim()) {
      return res.status(400).json({ message: "Institution, curriculum, and enrollment number are required." });
    }
    if (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1) {
      return res.status(400).json({ message: "Enter a valid admission year." });
    }
    if (!Number.isInteger(semester) || semester < 1 || semester > 16) {
      return res.status(400).json({ message: "Current semester must be between 1 and 16." });
    }
    if (!Number.isInteger(gaps) || gaps < 0 || gaps > 20) {
      return res.status(400).json({ message: "Gap years must be a whole number from 0 to 20." });
    }
    if (graduation !== null && (!Number.isInteger(graduation) || graduation < year || graduation > year + 20)) {
      return res.status(400).json({ message: "Enter a valid expected graduation year." });
    }
    if (target !== null && (!Number.isFinite(target) || target < 0 || target > 10)) {
      return res.status(400).json({ message: "Target CGPA must be between 0 and 10." });
    }

    await client.query("BEGIN");
    const profileResult = await client.query(
      `UPDATE public.student_profiles
          SET institution_id = $1,
              curriculum_id = $2,
              admission_mode_id = $3,
              student_identifier = $4,
              admission_year = $5,
              current_semester_number = $6,
              graduation_year = $7,
              target_cgpa = $8,
              gap_years = $9,
              updated_at = NOW()
        WHERE user_id = $10
        RETURNING id, user_id, institution_id, curriculum_id, admission_mode_id,
                  student_identifier, admission_year, current_semester_number,
                  graduation_year, target_cgpa, gap_years, current_cgpa,
                  current_earned_credits, created_at, updated_at`,
      [institutionId, curriculumId, admissionModeId || null, studentIdentifier.trim(), year, semester, graduation, target, gaps, user.id]
    );
    if (typeof displayName === "string") {
      const cleanName = displayName.trim().slice(0, 120) || null;
      await client.query("UPDATE public.users SET display_name = $1, updated_at = NOW() WHERE id = $2", [cleanName, user.id]);
    }
    await client.query(
      `INSERT INTO public.audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata)
       VALUES ('STUDENT', $1, 'STUDENT', 'STUDENT_PROFILE_UPDATED', 'student_profiles', $2, $3::jsonb)`,
      [user.id, profileResult.rows[0].id, JSON.stringify({ changedSections: ["identity", "academic_profile"], source: "student_portal" })]
    );
    await client.query("COMMIT");
    return res.status(200).json({ message: "Student profile updated successfully.", profile: profileResult.rows[0] });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* no active transaction */ }
    console.error("Failed to update student profile:", error);
    return res.status(500).json({ message: "Failed to update student profile." });
  } finally {
    client.release();
  }
}

/**
 * Soft-delete the student's account. Academic records and audit history are retained
 * so Super Admin can see the deleted account and its lifecycle event.
 */
export async function deleteStudentProfileController(
  req: AuthenticatedRequest,
  res: Response
) {
  const client = await pool.connect();
  try {
    if (!req.firebaseUser) return res.status(401).json({ message: "User is not authenticated." });
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user) return res.status(404).json({ message: "Gradly user account was not found." });
    if (!user.active) return res.status(403).json({ message: "This account has already been deactivated." });

    await client.query("BEGIN");
    const profile = await client.query(
      "SELECT id FROM public.student_profiles WHERE user_id = $1 LIMIT 1",
      [user.id]
    );
    await client.query(
      "UPDATE public.users SET active = FALSE, deleted_at = NOW(), updated_at = NOW() WHERE id = $1",
      [user.id]
    );
    await client.query(
      `INSERT INTO public.audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata)
       VALUES ('STUDENT', $1, 'STUDENT', 'STUDENT_ACCOUNT_SELF_DELETED', 'users', $1, $2::jsonb)`,
      [user.id, JSON.stringify({
        deletedAt: new Date().toISOString(),
        displayName: user.display_name ?? null,
        email: user.email ?? null,
        profileRetainedForSuperAdminAudit: true,
        studentProfileId: profile.rows[0]?.id ?? null,
      })]
    );
    await client.query("COMMIT");
    return res.status(200).json({
      message: "Your Gradly account has been deactivated. Academic records and the deletion audit remain available to Super Admin.",
      deleted: true,
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* no active transaction */ }
    console.error("Failed to deactivate student account:", error);
    return res.status(500).json({ message: "Could not deactivate your account." });
  } finally {
    client.release();
  }
}

/** Student dashboard summary, scoped to the authenticated account. */
export async function getStudentDashboardController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.firebaseUser) return res.status(401).json({ message: "User is not authenticated." });
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user) return res.status(404).json({ message: "Gradly user account was not found." });
    if (!user.active) return res.status(403).json({ message: "This account has been deactivated." });
    const profile = await getStudentProfile(user.id);
    if (!profile) return res.status(200).json({ user, profile: null, semesters: [] });
    const semestersResult = await pool.query(
      `SELECT ss.id, ss.attempt_number, ss.status, ss.result_publication_status, ss.result_source,
              ss.verified, ss.credits_registered, ss.credits_earned, ss.sgpa, ss.result_declared_at,
              sem.semester_number, sem.name AS semester_name
         FROM public.student_semesters ss
         JOIN public.semesters sem ON sem.id = ss.semester_id
        WHERE ss.student_profile_id = $1
        ORDER BY sem.semester_number, ss.attempt_number`,
      [profile.id]
    );
    const semesters = await Promise.all(semestersResult.rows.map(async (semester) => {
      const courses = await pool.query(
        `SELECT id, course_code_snapshot, course_name_snapshot, credits, registration_status,
                grade_symbol, grade_point, marks, maximum_marks, result_status, verified
           FROM public.student_semester_courses
          WHERE student_semester_id = $1
          ORDER BY course_name_snapshot`,
        [semester.id]
      );
      return { ...semester, courses: courses.rows };
    }));
    return res.status(200).json({ user, profile, semesters });
  } catch (error) {
    console.error("Failed to load student dashboard:", error);
    return res.status(500).json({ message: "Failed to load student dashboard." });
  }
}


export async function listStudentTasksController(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.firebaseUser) return res.status(401).json({ message: "User is not authenticated." });
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user || !user.active) return res.status(403).json({ message: "An active student account is required." });
    const result = await pool.query(
      "SELECT id, title, due_date, done, created_at, updated_at FROM public.student_study_tasks WHERE user_id = $1 ORDER BY done ASC, due_date ASC, created_at DESC",
      [user.id]
    );
    return res.status(200).json({ tasks: result.rows });
  } catch (error) {
    console.error("Failed to load study tasks:", error);
    return res.status(500).json({ message: "Could not load study tasks." });
  }
}

export async function createStudentTaskController(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.firebaseUser) return res.status(401).json({ message: "User is not authenticated." });
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user || !user.active) return res.status(403).json({ message: "An active student account is required." });
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const dueDate = typeof req.body?.dueDate === "string" ? req.body.dueDate : "";
    if (!title || title.length > 240) return res.status(400).json({ message: "Task title must be between 1 and 240 characters." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) return res.status(400).json({ message: "Choose a valid due date." });
    const result = await pool.query(
      "INSERT INTO public.student_study_tasks (user_id, title, due_date) VALUES ($1, $2, $3::date) RETURNING id, title, due_date, done, created_at, updated_at",
      [user.id, title, dueDate]
    );
    await pool.query(
      "INSERT INTO public.audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata) VALUES ('STUDENT', $1, 'STUDENT', 'STUDENT_STUDY_TASK_CREATED', 'student_study_tasks', $2, $3::jsonb)",
      [user.id, result.rows[0].id, JSON.stringify({ source: "student_portal" })]
    );
    return res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    console.error("Failed to create study task:", error);
    return res.status(500).json({ message: "Could not create study task." });
  }
}

export async function updateStudentTaskController(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.firebaseUser) return res.status(401).json({ message: "User is not authenticated." });
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user || !user.active) return res.status(403).json({ message: "An active student account is required." });
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : null;
    const dueDate = typeof req.body?.dueDate === "string" ? req.body.dueDate : null;
    const done = typeof req.body?.done === "boolean" ? req.body.done : null;
    if (title !== null && (!title || title.length > 240)) return res.status(400).json({ message: "Task title must be between 1 and 240 characters." });
    if (dueDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) return res.status(400).json({ message: "Choose a valid due date." });
    if (title === null && dueDate === null && done === null) return res.status(400).json({ message: "Provide a task title, due date, or completion status." });
    const result = await pool.query(
      "UPDATE public.student_study_tasks SET title = COALESCE($1, title), due_date = COALESCE($2::date, due_date), done = COALESCE($3, done), updated_at = NOW() WHERE id::text = $4 AND user_id = $5 RETURNING id, title, due_date, done, created_at, updated_at",
      [title, dueDate, done, req.params.taskId, user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Study task not found." });
    await pool.query(
      "INSERT INTO public.audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata) VALUES ('STUDENT', $1, 'STUDENT', 'STUDENT_STUDY_TASK_UPDATED', 'student_study_tasks', $2, $3::jsonb)",
      [user.id, result.rows[0].id, JSON.stringify({ changedFields: [title !== null ? "title" : null, dueDate !== null ? "dueDate" : null, done !== null ? "done" : null].filter(Boolean) })]
    );
    return res.status(200).json({ task: result.rows[0] });
  } catch (error) {
    console.error("Failed to update study task:", error);
    return res.status(500).json({ message: "Could not update study task." });
  }
}

export async function deleteStudentTaskController(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.firebaseUser) return res.status(401).json({ message: "User is not authenticated." });
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user || !user.active) return res.status(403).json({ message: "An active student account is required." });
    const result = await pool.query(
      "DELETE FROM public.student_study_tasks WHERE id::text = $1 AND user_id = $2 RETURNING id",
      [req.params.taskId, user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Study task not found." });
    await pool.query(
      "INSERT INTO public.audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata) VALUES ('STUDENT', $1, 'STUDENT', 'STUDENT_STUDY_TASK_DELETED', 'student_study_tasks', $2, '{}'::jsonb)",
      [user.id, result.rows[0].id]
    );
    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error("Failed to delete study task:", error);
    return res.status(500).json({ message: "Could not delete study task." });
  }
}
