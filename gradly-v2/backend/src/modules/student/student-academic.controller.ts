import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

type StudentProfile = {
  id: string;
  curriculum_id: string;
};

async function resolveProfile(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser) {
    res.status(401).json({ message: "User is not authenticated." });
    return null;
  }
  const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
  if (!user) {
    res.status(404).json({ message: "Gradly user account was not found." });
    return null;
  }
  const result = await pool.query(
    "SELECT id, curriculum_id FROM student_profiles WHERE user_id = $1 LIMIT 1",
    [user.id],
  );
  if (!result.rows[0]) {
    res.status(409).json({ message: "Complete your academic profile before saving results." });
    return null;
  }
  return { user, profile: result.rows[0] as StudentProfile };
}

export async function listStudentAcademicRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const resolved = await resolveProfile(req, res);
    if (!resolved) return;
    const semesters = await pool.query(
      `SELECT ss.id, sem.semester_number, sem.name AS semester_name,
              ss.attempt_number, ss.status, ss.result_source, ss.verified,
              ss.credits_registered, ss.credits_earned, ss.sgpa,
              ss.result_declared_at, ss.created_at, ss.updated_at
       FROM student_semesters ss
       JOIN semesters sem ON sem.id = ss.semester_id
       WHERE ss.student_profile_id = $1
       ORDER BY sem.semester_number, ss.attempt_number`,
      [resolved.profile.id],
    );
    const courses = await pool.query(
      `SELECT c.id, c.student_semester_id, c.curriculum_subject_id,
              c.course_code_snapshot, c.course_name_snapshot, c.credits,
              c.registration_status, c.grade_symbol, c.grade_point,
              c.marks, c.maximum_marks, c.result_status, c.result_source,
              c.verified, c.attempt_number
       FROM student_semester_courses c
       JOIN student_semesters ss ON ss.id = c.student_semester_id
       WHERE ss.student_profile_id = $1
       ORDER BY c.course_name_snapshot`,
      [resolved.profile.id],
    );
    const courseMap = new Map<string, typeof courses.rows>();
    for (const course of courses.rows) {
      const rows = courseMap.get(course.student_semester_id) ?? [];
      rows.push(course);
      courseMap.set(course.student_semester_id, rows);
    }
    const records = semesters.rows.map((semester) => ({
      ...semester,
      courses: courseMap.get(semester.id) ?? [],
    }));
    const graded = courses.rows.filter((course) => course.grade_point !== null);
    const totalCredits = graded.reduce((sum, course) => sum + Number(course.credits || 0), 0);
    const weightedPoints = graded.reduce(
      (sum, course) => sum + Number(course.credits || 0) * Number(course.grade_point || 0), 0,
    );
    return res.status(200).json({
      records,
      summary: {
        cgpa: totalCredits ? Number((weightedPoints / totalCredits).toFixed(2)) : null,
        gradedCredits: totalCredits,
        subjectCount: graded.length,
        gradeDistribution: graded.reduce((distribution: Record<string, number>, course) => {
          const grade = String(course.grade_symbol || "Ungraded");
          distribution[grade] = (distribution[grade] || 0) + 1;
          return distribution;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Failed to load student academic records:", error);
    return res.status(500).json({ message: "Failed to load academic records." });
  }
}

/**
 * Saves or updates the signed-in student's manual SGPA entry for a semester.
 * Curriculum subjects, their credits and the grading scale are always resolved
 * from the student's saved curriculum; client-supplied values are not trusted.
 */
export async function saveStudentSemesterResult(req: AuthenticatedRequest, res: Response) {
  const client = await pool.connect();
  try {
    const resolved = await resolveProfile(req, res);
    if (!resolved) return;

    const semesterNumber = Number(req.body?.semesterNumber);
    const courses = req.body?.courses;
    const attemptNumber = Number(req.body?.attemptNumber ?? 1);
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12 ||
        !Number.isInteger(attemptNumber) || attemptNumber !== 1 ||
        !Array.isArray(courses) || courses.length === 0 || courses.length > 100) {
      return res.status(400).json({ message: "Choose a valid semester and provide 1–100 curriculum subjects." });
    }

    const ids = courses.map((course: { curriculumSubjectId?: unknown }) => String(course?.curriculumSubjectId ?? "").trim());
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (ids.some((id: string) => !uuidPattern.test(id)) || new Set(ids).size !== ids.length) {
      return res.status(400).json({ message: "Every selected subject must belong to the active curriculum." });
    }

    await client.query("BEGIN");
    await client.query("SELECT id FROM student_profiles WHERE id = $1 FOR UPDATE", [resolved.profile.id]);

    const semesterResult = await client.query(
      `SELECT id FROM semesters
       WHERE curriculum_id = $1 AND semester_number = $2
       LIMIT 1`,
      [resolved.profile.curriculum_id, semesterNumber],
    );
    if (!semesterResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "This semester is not part of your selected programme, branch and scheme." });
    }
    const semesterId = String(semesterResult.rows[0].id);

    const gradingResult = await client.query(
      `SELECT gd.symbol, gd.grade_point, gd.pass, gs.decimal_places
       FROM curricula c
       JOIN grading_systems gs ON gs.id = c.grading_system_id AND gs.active = TRUE
       JOIN grade_definitions gd ON gd.grading_system_id = gs.id
       WHERE c.id = $1
       ORDER BY gd.grade_point DESC, gd.symbol ASC`,
      [resolved.profile.curriculum_id],
    );
    if (!gradingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "A grading scale is not configured for your selected curriculum." });
    }
    const decimalPlaces = Math.max(0, Math.min(4, Number(gradingResult.rows[0].decimal_places ?? 2)));
    const gradeMap = new Map<string, { point: number; passed: boolean }>(
      gradingResult.rows.map((grade) => [String(grade.symbol).trim().toUpperCase(), {
        point: Number(grade.grade_point), passed: Boolean(grade.pass),
      }]),
    );

    const curriculumSubjects = await client.query(
      `SELECT id, course_code, course_name, credits, mandatory
       FROM curriculum_subjects
       WHERE curriculum_id = $1 AND semester_id = $2 AND active = TRUE`,
      [resolved.profile.curriculum_id, semesterId],
    );
    const subjectMap = new Map(curriculumSubjects.rows.map((subject) => [String(subject.id), subject]));
    if (ids.some((id: string) => !subjectMap.has(id))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "One or more selected subjects do not belong to this semester's active curriculum." });
    }

    const normalized = [];
    for (const course of courses) {
      const subject = subjectMap.get(String(course.curriculumSubjectId));
      const grade = String(course.gradeSymbol ?? "").trim().toUpperCase();
      const gradeDefinition = gradeMap.get(grade);
      if (!subject || !gradeDefinition) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Choose a valid grade for every selected curriculum subject." });
      }
      normalized.push({
        subject,
        grade,
        point: gradeDefinition.point,
        passed: gradeDefinition.passed,
      });
    }

    const selectedIds = new Set(ids);
    const missingMandatory = curriculumSubjects.rows.filter((subject) => subject.mandatory && Number(subject.credits) > 0 && !selectedIds.has(String(subject.id)));
    if (missingMandatory.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Include all mandatory subjects before saving this semester." });
    }

    const creditsRegistered = normalized.reduce((sum, course) => sum + Number(course.subject.credits), 0);
    const weightedPoints = normalized.reduce(
      (sum, course) => sum + Number(course.subject.credits) * course.point, 0,
    );
    const creditsEarned = normalized.reduce(
      (sum, course) => sum + (course.passed ? Number(course.subject.credits) : 0), 0,
    );
    if (creditsRegistered <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "The selected subjects do not contain valid credits." });
    }
    const multiplier = 10 ** decimalPlaces;
    const sgpa = Math.round(((weightedPoints / creditsRegistered) + Number.EPSILON) * multiplier) / multiplier;

    const existing = await client.query(
      `SELECT id, result_source, verified
       FROM student_semesters
       WHERE student_profile_id = $1 AND semester_id = $2 AND attempt_number = $3
       FOR UPDATE`,
      [resolved.profile.id, semesterId, attemptNumber],
    );
    if (existing.rows[0] && (existing.rows[0].verified || existing.rows[0].result_source !== "MANUAL_ENTRY")) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "An official or verified result already exists for this semester and cannot be overwritten here." });
    }

    const saved = await client.query(
      `INSERT INTO student_semesters
         (student_profile_id, curriculum_id, semester_id, attempt_number,
          status, result_publication_status, result_source, verified,
          credits_registered, credits_earned, sgpa, sgpa_calculated_at, result_declared_at)
       VALUES ($1, $2, $3, $4, 'COMPLETED', 'DECLARED', 'MANUAL_ENTRY', FALSE,
               $5, $6, $7, NOW(), NOW())
       ON CONFLICT (student_profile_id, semester_id, attempt_number)
       DO UPDATE SET curriculum_id = EXCLUDED.curriculum_id,
                     status = 'COMPLETED',
                     result_publication_status = 'DECLARED',
                     result_source = 'MANUAL_ENTRY',
                     verified = FALSE,
                     credits_registered = EXCLUDED.credits_registered,
                     credits_earned = EXCLUDED.credits_earned,
                     sgpa = EXCLUDED.sgpa,
                     sgpa_calculated_at = NOW(),
                     result_declared_at = NOW(),
                     updated_at = NOW()
       RETURNING id, semester_id, attempt_number, created_at, updated_at`,
      [resolved.profile.id, resolved.profile.curriculum_id, semesterId, attemptNumber,
       creditsRegistered, creditsEarned, sgpa],
    );
    const semesterRecord = saved.rows[0];

    await client.query(
      "DELETE FROM student_semester_courses WHERE student_semester_id = $1",
      [semesterRecord.id],
    );
    for (const course of normalized) {
      await client.query(
        `INSERT INTO student_semester_courses
          (student_semester_id, curriculum_subject_id, course_code_snapshot,
           course_name_snapshot, credits, registration_status, grade_symbol,
           grade_point, result_status, result_source, verified, attempt_number)
         VALUES ($1, $2, $3, $4, $5, 'REGISTERED', $6, $7, 'DECLARED', 'MANUAL_ENTRY', FALSE, $8)`,
        [semesterRecord.id, course.subject.id, course.subject.course_code || "",
         course.subject.course_name, Number(course.subject.credits), course.grade,
         course.point, attemptNumber],
      );
    }

    await client.query("COMMIT");
    return res.status(existing.rows[0] ? 200 : 201).json({
      message: existing.rows[0] ? "Semester result updated." : "Semester result saved.",
      semester: {
        id: semesterRecord.id,
        semesterNumber,
        attemptNumber,
        sgpa,
        credits: creditsRegistered,
        savedAt: semesterRecord.updated_at,
        decimalPlaces,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to save student semester result:", error);
    return res.status(500).json({ message: "Failed to save semester result." });
  } finally {
    client.release();
  }
}
