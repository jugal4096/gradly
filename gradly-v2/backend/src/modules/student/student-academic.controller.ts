import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

const gradePoints: Record<string, number> = {
  "A++": 10, "A+": 9, A: 8, "B+": 7, B: 6, "C+": 5, C: 4, D: 0,
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
  return { user, profile: result.rows[0] as { id: string; curriculum_id: string } };
}

export async function listStudentAcademicRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const resolved = await resolveProfile(req, res);
    if (!resolved) return;
    const semesters = await pool.query(
      `SELECT ss.id, sem.semester_number, sem.name AS semester_name,
              ss.attempt_number, ss.status, ss.result_source, ss.verified,
              ss.credits_registered, ss.credits_earned, ss.sgpa,
              ss.result_declared_at, ss.created_at
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

export async function saveStudentSemesterResult(req: AuthenticatedRequest, res: Response) {
  const resolved = await resolveProfile(req, res);
  if (!resolved) return;
  const semesterNumber = Number(req.body?.semesterNumber);
  const courses = req.body?.courses;
  const attemptNumber = Number(req.body?.attemptNumber ?? 1);
  if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12 ||
      !Number.isInteger(attemptNumber) || attemptNumber < 1 ||
      !Array.isArray(courses) || courses.length === 0 || courses.length > 100) {
    return res.status(400).json({ message: "Provide a valid semester, attempt number and 1–100 subjects." });
  }
  const normalized = [];
  for (const course of courses) {
    const code = String(course?.courseCode ?? "").trim();
    const name = String(course?.courseName ?? "").trim();
    const credits = Number(course?.credits);
    const grade = String(course?.gradeSymbol ?? "").trim().toUpperCase();
    const point = course?.gradePoint === undefined ? gradePoints[grade] : Number(course.gradePoint);
    if (!name || !Number.isFinite(credits) || credits <= 0 || credits > 30 ||
        !Number.isFinite(point) || point < 0 || point > 10) {
      return res.status(400).json({ message: "Each subject needs a name, positive credits and a grade point from 0 to 10." });
    }
    normalized.push({ code, name, credits, grade, point });
  }
  const creditsRegistered = normalized.reduce((sum, course) => sum + course.credits, 0);
  const sgpa = normalized.reduce((sum, course) => sum + course.credits * course.point, 0) / creditsRegistered;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const semesterResult = await client.query(
      `SELECT DISTINCT sem.id
       FROM curriculum_subjects cs
       JOIN semesters sem ON sem.id = cs.semester_id
       WHERE cs.curriculum_id = $1 AND sem.semester_number = $2
       LIMIT 1`,
      [resolved.profile.curriculum_id, semesterNumber],
    );
    if (!semesterResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No curriculum semester is configured for this semester. Check your academic profile and scheme." });
    }
    const inserted = await client.query(
      `INSERT INTO student_semesters
         (student_profile_id, curriculum_id, semester_id, attempt_number,
         status, result_publication_status, result_source, verified,
         credits_registered, credits_earned, sgpa, sgpa_calculated_at, result_declared_at)
       VALUES ($1, $2, $3, $4, 'COMPLETED', 'DECLARED', 'MANUAL_ENTRY', FALSE,
               $5, $6, $7, NOW(), NOW())
       RETURNING id, semester_id, attempt_number`,
      [resolved.profile.id, resolved.profile.curriculum_id, semesterResult.rows[0].id, attemptNumber,
       creditsRegistered, normalized.filter(course => course.point > 0).reduce((sum, course) => sum + course.credits, 0),
       Number(sgpa.toFixed(2))],
    );
    const semesterRecord = inserted.rows[0];
    for (const course of normalized) {
      const curriculumSubject = course.code
        ? await client.query(
            `SELECT id FROM curriculum_subjects
             WHERE curriculum_id = $1 AND semester_id = $2 AND course_code = $3
             LIMIT 1`,
            [resolved.profile.curriculum_id, semesterRecord.semester_id, course.code],
          )
        : { rows: [] };
      await client.query(
        `INSERT INTO student_semester_courses
          (student_semester_id, curriculum_subject_id, course_code_snapshot,
           course_name_snapshot, credits, registration_status, grade_symbol,
           grade_point, result_status, result_source, attempt_number)
         VALUES ($1, $2, $3, $4, $5, 'REGISTERED', $6, $7, 'DECLARED', 'MANUAL_ENTRY', $8)`,
        [semesterRecord.id, curriculumSubject.rows[0]?.id ?? null, course.code || null,
         course.name, course.credits, course.grade || null, course.point, attemptNumber],
      );
    }
    await client.query("COMMIT");
    return res.status(201).json({
      message: "Semester result saved.",
      semester: { id: semesterRecord.id, semesterNumber, attemptNumber, sgpa: Number(sgpa.toFixed(2)), credits: creditsRegistered },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to save student semester result:", error);
    return res.status(500).json({ message: "Failed to save semester result." });
  } finally {
    client.release();
  }
}
