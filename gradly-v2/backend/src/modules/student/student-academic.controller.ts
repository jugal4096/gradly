import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

const gradePoints: Record<string, number> = {
  "A++": 10, "A+": 9, A: 8, "B+": 7, B: 6, "C+": 5, C: 4, D: 0, D1: 0, D2: 0, D3: 0, F: 0, AB: 0,
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
    "SELECT id, curriculum_id, current_semester_number FROM student_profiles WHERE user_id = $1 LIMIT 1",
    [user.id],
  );
  if (!result.rows[0]) {
    res.status(409).json({ message: "Complete your academic profile before saving results." });
    return null;
  }
  return { user, profile: result.rows[0] as { id: string; curriculum_id: string; current_semester_number: number | null } };
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
    const latestCourses = await pool.query(
      `SELECT c.grade_symbol, c.grade_point, c.credits
       FROM student_semester_courses c
       JOIN student_semesters ss ON ss.id = c.student_semester_id
       JOIN semesters sem ON sem.id = ss.semester_id
       WHERE ss.student_profile_id = $1
         AND ss.attempt_number = (
           SELECT MAX(latest.attempt_number)
           FROM student_semesters latest
           WHERE latest.student_profile_id = ss.student_profile_id
             AND latest.semester_id = ss.semester_id
         )`,
      [resolved.profile.id],
    );
    const graded = latestCourses.rows.filter((course) => course.grade_point !== null);
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
  const currentSemester = Number(resolved.profile.current_semester_number || 0);
  if (!currentSemester || semesterNumber > currentSemester) {
    return res.status(403).json({
      code: "SGPA_SEMESTER_LOCKED",
      message: "Manual SGPA entry is available only for semesters up to your current semester.",
    });
  }
  const normalized = [];
  for (const course of courses) {
    const code = String(course?.courseCode ?? "").trim();
    const name = String(course?.courseName ?? "").trim();
    const credits = Number(course?.credits);
    const grade = String(course?.gradeSymbol ?? "").trim().toUpperCase();
    const point = course?.gradePoint === undefined ? gradePoints[grade] : Number(course.gradePoint);
    const isZeroCreditMandatory = ["INMC2001","INMC2010"].includes(code.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    if (!name || !Number.isFinite(credits) || credits < 0 || (credits === 0 && !isZeroCreditMandatory) || credits > 30 ||
        !Number.isFinite(point) || point < 0 || point > 10) {
      return res.status(400).json({ message: "Each subject needs a name, valid credits (zero is allowed only for Environmental Science (INMC2001)) and a grade point from 0 to 10." });
    }
    normalized.push({ code, name, credits, grade, point });
  }
  const openElectiveCodes = new Set([
    "CE3008","CE2014","CEOE0040","CEOE1010","ME2022","ME4015","MEOE0031","ME4031","ME3027","MEOE0050",
    "MEOE1040","EE3018","EE4046","ET3033","ET3034","ET3035","CS2017","OEIT4001",
  ]);
  const submittedOECodes = normalized.map(course => course.code.toUpperCase()).filter(code => openElectiveCodes.has(code));
  if (new Set(submittedOECodes).size !== submittedOECodes.length) {
    return res.status(409).json({ code: "OE_ALREADY_REGISTERED", message: "An Open Elective can be registered only once throughout your degree. Remove the duplicate subject." });
  }
  const uhvCourses = normalized.filter(course => course.code.toUpperCase() === "INHS1020");
  if (uhvCourses.length > 1) {
    return res.status(400).json({ code: "UHV_DUPLICATE", message: "Universal Human Values can be registered only once throughout your degree." });
  }
  const creditsRegistered = normalized.reduce((sum, course) => sum + course.credits, 0);
  if (creditsRegistered <= 0) {
    return res.status(400).json({ message: "At least one credit-bearing subject is required to calculate SGPA." });
  }
  const creditsWithoutUhv = normalized.filter(course => course.code.toUpperCase() !== "INHS1020")
    .reduce((sum, course) => sum + course.credits, 0);
  const isOfficialGecaImport = req.body?.resultSource === "GECA_OFFICIAL";
  if (creditsWithoutUhv > 28 && !isOfficialGecaImport) {
    return res.status(400).json({ code: "SEMESTER_CREDIT_LIMIT", message: "A semester cannot exceed 28 registered credits, excluding the one-time UHV allowance." });
  }
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
    // GECA imports must never attach a course from another semester to this
    // semester's record. This is a server-side guard in addition to the
    // frontend curriculum reconciliation.
    if (isOfficialGecaImport) {
      const curriculumCodesResult = await client.query(
        `SELECT DISTINCT UPPER(course_code) AS code
         FROM curriculum_subjects
         WHERE curriculum_id = $1 AND semester_id = $2 AND course_code IS NOT NULL`,
        [resolved.profile.curriculum_id, semesterResult.rows[0].id],
      );
      const discoveredCodesResult = await client.query(
        `SELECT course_code AS code
         FROM public.discovered_result_subjects
         WHERE curriculum_id = $1 AND semester_number = $2`,
        [resolved.profile.curriculum_id, semesterNumber],
      );
      const allowedCodes = new Set<string>([
        ...curriculumCodesResult.rows.map((row: { code: string }) =>
          String(row.code || "").replace(/[^A-Z0-9]/g, ""),
        ),
        ...discoveredCodesResult.rows.map((row: { code: string }) =>
          String(row.code || "").replace(/[^A-Z0-9]/g, ""),
        ),
        // Shared GECA humanities and one-time UHV subjects are not always
        // returned by the branch-specific curriculum subject query.
        "CEHS1030",
        "INHS1020",
        "INMC2001",
        "INMC2010",
        "MEOE1040",
        "EE3018",
        // Open Electives are selected per student and are not always rows in
        // the base branch curriculum_subjects table. Validate against the
        // official GECA OE catalogue rather than rejecting a valid OE result.
        ...[...openElectiveCodes].filter(code => code !== "CEOE1010"),
        // CEOE1010 is Disaster Management, an official GECA even-semester OE.
        ...(semesterNumber === 6 ? ["CEOE1010", "ITHS1030", "ITPE3005", "ITPE3006", "ITPE3007", "ITPE3008", "ITPE3032", "ITPC3010", "ITPR3002"] : []),
      ]);
      const invalidCodes = [...new Set(normalized
        .map(course => course.code.toUpperCase().replace(/[^A-Z0-9]/g, ""))
        .filter(code => code && !allowedCodes.has(code)))];
      if (invalidCodes.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          code: "GECA_COURSE_SEMESTER_MISMATCH",
          message: `The GECA result contains course(s) not registered in Semester ${semesterNumber}: ${invalidCodes.join(", ")}. No grades were saved.`,
        });
      }
    }
    const existing = await client.query(
      `SELECT id FROM student_semesters
       WHERE student_profile_id = $1 AND semester_id = $2 AND attempt_number = $3
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [resolved.profile.id, semesterResult.rows[0].id, attemptNumber],
    );
    if (submittedOECodes.length) {
      const priorOE = await client.query(
        `SELECT c.course_code_snapshot, c.course_name_snapshot, sem.semester_number
         FROM student_semester_courses c
         JOIN student_semesters ss ON ss.id = c.student_semester_id
         JOIN semesters sem ON sem.id = ss.semester_id
         WHERE ss.student_profile_id = $1
           AND UPPER(COALESCE(c.course_code_snapshot, '')) = ANY($2::text[])
           AND ss.semester_id <> $3
         LIMIT 1`,
        [resolved.profile.id, submittedOECodes, semesterResult.rows[0].id],
      );
      if (priorOE.rows.length) {
        await client.query("ROLLBACK");
        const prior = priorOE.rows[0];
        return res.status(409).json({
          code: "OE_ALREADY_REGISTERED",
          message: `${prior.course_name_snapshot || prior.course_code_snapshot} has already been opted in Semester ${prior.semester_number}. An Open Elective can be registered only once throughout your degree.`,
        });
      }
    }
    if (uhvCourses.length) {
      const priorUhv = await client.query(
        `SELECT c.id
         FROM student_semester_courses c
         JOIN student_semesters ss ON ss.id = c.student_semester_id
         WHERE ss.student_profile_id = $1
           AND UPPER(COALESCE(c.course_code_snapshot, '')) = 'INHS1020'
           AND ss.semester_id <> $2
         LIMIT 1`,
        [resolved.profile.id, semesterResult.rows[0].id],
      );
      if (priorUhv.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          code: "UHV_ALREADY_REGISTERED",
          message: "Universal Human Values has already been registered in another semester. It can be added only once throughout your degree.",
        });
      }
    }
    const earnedCredits = normalized.filter(course => course.point > 0).reduce((sum, course) => sum + course.credits, 0);
    let semesterRecord: { id: string; semester_id: string; attempt_number: number };
    if (existing.rows[0]) {
      const updated = await client.query(
        `UPDATE student_semesters
         SET curriculum_id = $2, status = 'COMPLETED', result_publication_status = 'NOT_PUBLISHED',
             result_source = 'MANUAL_ENTRY', verified = FALSE,
             credits_registered = $3, credits_earned = $4, sgpa = $5,
             sgpa_calculated_at = NOW(), result_declared_at = NULL
         WHERE id = $1
         RETURNING id, semester_id, attempt_number`,
        [existing.rows[0].id, resolved.profile.curriculum_id, creditsRegistered, earnedCredits, Number(sgpa.toFixed(2))],
      );
      semesterRecord = updated.rows[0];
      await client.query("DELETE FROM student_semester_courses WHERE student_semester_id = $1", [semesterRecord.id]);
    } else {
      const inserted = await client.query(
        `INSERT INTO student_semesters
           (student_profile_id, curriculum_id, semester_id, attempt_number,
           status, result_publication_status, result_source, verified,
           credits_registered, credits_earned, sgpa, sgpa_calculated_at, result_declared_at)
         VALUES ($1, $2, $3, $4, 'COMPLETED', 'NOT_PUBLISHED', 'MANUAL_ENTRY', FALSE,
                 $5, $6, $7, NOW(), NULL)
         RETURNING id, semester_id, attempt_number`,
        [resolved.profile.id, resolved.profile.curriculum_id, semesterResult.rows[0].id, attemptNumber,
         creditsRegistered, earnedCredits, Number(sgpa.toFixed(2))],
      );
      semesterRecord = inserted.rows[0];
    }
    // Insert the semester's subjects in one database round-trip. The previous
    // per-course loop performed a curriculum lookup and INSERT for every row,
    // making a 13-subject result require 26 sequential queries.
    await client.query(
      `INSERT INTO student_semester_courses
        (student_semester_id, curriculum_subject_id, course_code_snapshot,
         course_name_snapshot, credits, registration_status, grade_symbol,
         grade_point, result_status, result_source, attempt_number)
       SELECT $1, curriculum_subject.id, course.course_code, course.course_name,
              course.credits, 'REGISTERED', course.grade_symbol, course.grade_point,
              CASE WHEN course.grade_point > 0::numeric THEN 'PASS' ELSE 'FAIL' END,
              'MANUAL_ENTRY', $7
       FROM unnest(
         $2::text[], $3::text[], $4::numeric[], $5::text[], $6::numeric[]
       ) AS course(course_code, course_name, credits, grade_symbol, grade_point)
       LEFT JOIN LATERAL (
         SELECT id
         FROM curriculum_subjects
         WHERE curriculum_id = $8
           AND semester_id = $9
           AND course_code = course.course_code
         LIMIT 1
       ) AS curriculum_subject ON TRUE`,
      [
        semesterRecord.id,
        normalized.map(course => course.code || null),
        normalized.map(course => course.name),
        normalized.map(course => course.credits),
        normalized.map(course => course.grade || null),
        normalized.map(course => course.point),
        attemptNumber,
        resolved.profile.curriculum_id,
        semesterRecord.semester_id,
      ],
    );
    await client.query("COMMIT");
    return res.status(201).json({
      message: "Semester result saved.",
      semester: { id: semesterRecord.id, semesterNumber, attemptNumber, sgpa: Number(sgpa.toFixed(2)), credits: creditsRegistered },
      updated: Boolean(existing.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to save student semester result:", error);
    return res.status(500).json({ message: "Failed to save semester result." });
  } finally {
    client.release();
  }
}
