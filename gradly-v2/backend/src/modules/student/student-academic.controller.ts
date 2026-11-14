import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

const gradePoints: Record<string, number> = {
  "A++": 10, "A+": 9, A: 8, "B+": 7, B: 6, "C+": 5, C: 4, D: 0,
};

// GECA B.Tech NEP Open Elective basket. NEPOE_* values are internal identifiers, not official course codes.
const nepOpenElectiveCatalog = [
  { code: "NEPOE_CE_3_RURAL_TECHNOLOGY", department: "CE", semester: 3, credits: 3 },
  { code: "NEPOE_CE_4_DISASTER_MANAGEMENT", department: "CE", semester: 4, credits: 3 },
  { code: "NEPOE_CE_5_WATERSHED_MANAGEMENT", department: "CE", semester: 5, credits: 2 },
  { code: "NEPOE_ME_3_INDUSTRIAL_PSYCHOLOGY", department: "ME", semester: 3, credits: 3 },
  { code: "NEPOE_ME_3_ENGINEERING_ECONOMICS", department: "ME", semester: 3, credits: 3 },
  { code: "NEPOE_ME_3_ETHICAL_VALUES", department: "ME", semester: 3, credits: 3 },
  { code: "NEPOE_ME_3_SMART_MOBILITY_ROAD_SAFETY", department: "ME", semester: 3, credits: 3 },
  { code: "MEOEC2020", department: "ME", semester: 4, credits: 3 },
  { code: "MEOEC2021", department: "ME", semester: 4, credits: 3 },
  { code: "MEOEC2022", department: "ME", semester: 4, credits: 3 },
  { code: "NEPOE_ME_4_GREEN_HYDROGEN_FINANCING", department: "ME", semester: 4, credits: 3 },
  { code: "NEPOE_ME_5_ENTREPRENEURSHIP_DEVELOPMENT", department: "ME", semester: 5, credits: 2 },
  { code: "NEPOE_ME_5_FINANCIAL_MANAGEMENT", department: "ME", semester: 5, credits: 2 },
  { code: "EEOEC2001", department: "EE", semester: 3, credits: 3 },
  { code: "EEOEC2010", department: "EE", semester: 4, credits: 2 },
  { code: "EEOEC3001", department: "EE", semester: 5, credits: 3 },
  { code: "ETOEC0010", department: "ET", semester: 3, credits: 0 },
  { code: "ETOEC1020", department: "ET", semester: 4, credits: 0 },
  { code: "ETOEC0030", department: "ET", semester: 5, credits: 0 },
  { code: "ETOEC0011", department: "ET", semester: 3, credits: 0 },
  { code: "ETOEC1021", department: "ET", semester: 4, credits: 0 },
  { code: "ETOEC0031", department: "ET", semester: 5, credits: 0 },
  { code: "NEPOE_CS_3_DESIGN_THINKING", department: "CS", semester: 3, credits: 3 },
  { code: "NEPOE_CS_3_CRITICAL_THINKING", department: "CS", semester: 3, credits: 3 },
  { code: "NEPOE_CS_4_PECL", department: "CS", semester: 4, credits: 3 },
  { code: "NEPOE_CS_4_SOFTWARE_DEVELOPMENT_CYCLE", department: "CS", semester: 4, credits: 3 },
  { code: "NEPOE_CS_5_BEHAVIORAL_SCIENCE_ORGANIZATION", department: "CS", semester: 5, credits: 2 },
] as const;

function getMajorDepartmentCode(branchCode: string, branchName: string): string | null {
  const code = String(branchCode || "").trim().toUpperCase();
  if (["CE", "ME", "EE", "ET", "CS", "IT"].includes(code)) return code;
  const name = String(branchName || "").toLowerCase();
  if (/civil/.test(name)) return "CE";
  if (/mechanical/.test(name)) return "ME";
  if (/electrical/.test(name)) return "EE";
  if (/electronics|telecommunication|entc|e\s*&\s*tc/.test(name)) return "ET";
  if (/computer science|\bcse\b/.test(name)) return "CS";
  if (/information technology|\bit\b/.test(name)) return "IT";
  return null;
}

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
    if (!name || !Number.isFinite(credits) || credits <= 0 || credits > 30 ||
        !Number.isFinite(point) || point < 0 || point > 10) {
      return res.status(400).json({ message: "Each subject needs a name, positive credits and a grade point from 0 to 10." });
    }
    normalized.push({ code, name, credits, grade, point });
  }
  const openElectiveCodes = new Set([
    "CE3008","CE2014","CEOE0040","ME2022","ME4015","ME4031","ME3027","MEOE0050",
    "EE3018","EE4046","ET3033","ET3034","ET3035","CS2017","OEIT4001",
  ]);
  const submittedOECodes = normalized.map(course => course.code.toUpperCase()).filter(code => openElectiveCodes.has(code) || /^NEPOE_|^[A-Z]{2}OEC/.test(code));
  if (new Set(submittedOECodes).size !== submittedOECodes.length) {
    return res.status(409).json({ code: "OE_ALREADY_REGISTERED", message: "An Open Elective can be registered only once throughout your degree. Remove the duplicate subject." });
  }
  const uhvCourses = normalized.filter(course => course.code.toUpperCase() === "INHS1020");
  if (uhvCourses.length > 1) {
    return res.status(400).json({ code: "UHV_DUPLICATE", message: "Universal Human Values can be registered only once throughout your degree." });
  }
  const creditsRegistered = normalized.reduce((sum, course) => sum + course.credits, 0);
  const creditsWithoutUhv = normalized.filter(course => course.code.toUpperCase() !== "INHS1020")
    .reduce((sum, course) => sum + course.credits, 0);
  if (creditsWithoutUhv > 28) {
    return res.status(400).json({ code: "SEMESTER_CREDIT_LIMIT", message: "A semester cannot exceed 28 registered credits, excluding the one-time UHV allowance." });
  }
  const sgpa = normalized.reduce((sum, course) => sum + course.credits * course.point, 0) / creditsRegistered;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const curriculumContext = await client.query(
      `SELECT sc.name AS scheme_name, p.name AS programme_name,
              b.code AS branch_code, b.name AS branch_name
       FROM curricula c
       LEFT JOIN schemes sc ON sc.id = c.scheme_id
       LEFT JOIN programs p ON p.id = c.program_id
       LEFT JOIN branches b ON b.id = c.branch_id
       WHERE c.id = $1 LIMIT 1`,
      [resolved.profile.curriculum_id],
    );
    const context = curriculumContext.rows[0] || {};
    const isNepBtech = /\bnep\b/i.test(String(context.scheme_name || "")) &&
      !/new\s*cbcs/i.test(String(context.scheme_name || "")) &&
      /bachelor of technology|\bb\.?\s*tech\b|\bb\.?\s*e\.?\b/i.test(String(context.programme_name || ""));
    if (isNepBtech && submittedOECodes.length) {
      const majorDepartment = getMajorDepartmentCode(String(context.branch_code || ""), String(context.branch_name || ""));
      for (const code of submittedOECodes) {
        const option = nepOpenElectiveCatalog.find(item => item.code.toUpperCase() === code);
        if (!option) {
          await client.query("ROLLBACK");
          return res.status(400).json({ code: "NEP_OE_NOT_APPROVED", message: "This Open Elective is not in the approved NEP Open Elective catalogue." });
        }
        if (option.semester !== semesterNumber) {
          await client.query("ROLLBACK");
          return res.status(400).json({ code: "NEP_OE_WRONG_SEMESTER", message: `${code} is approved only for Semester ${option.semester}.` });
        }
        if (majorDepartment && option.department === majorDepartment) {
          await client.query("ROLLBACK");
          return res.status(400).json({ code: "NEP_OE_SAME_DEPARTMENT", message: "Choose an Open Elective offered by a department other than your major department." });
        }
        const submittedCourse = normalized.find(course => course.code.toUpperCase() === code);
        if (option.credits > 0 && submittedCourse && submittedCourse.credits !== option.credits) {
          await client.query("ROLLBACK");
          return res.status(400).json({ code: "NEP_OE_CREDIT_MISMATCH", message: `${code} carries ${option.credits} credits in the approved NEP catalogue.` });
        }
      }
    }
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
    if (isNepBtech) {
      const oeSlots = await client.query(
        `SELECT cs.credits
         FROM curriculum_subjects cs
         JOIN semesters sem ON sem.id = cs.semester_id
         WHERE cs.curriculum_id = $1 AND sem.semester_number = $2
           AND (UPPER(COALESCE(cs.course_type, '')) LIKE '%OPEN ELECTIVE%'
             OR UPPER(COALESCE(cs.course_type, '')) = 'OE'
             OR COALESCE(cs.course_name, '') ILIKE '%open elective%')
           AND (cs.active IS TRUE OR NOT EXISTS (
             SELECT 1 FROM curriculum_subjects active_cs
             JOIN semesters active_sem ON active_sem.id = active_cs.semester_id
             WHERE active_cs.curriculum_id = $1 AND active_sem.semester_number = $2
               AND active_cs.active IS TRUE
           ))
         ORDER BY cs.course_code, cs.course_name`,
        [resolved.profile.curriculum_id, semesterNumber],
      );
      if (oeSlots.rows.length) {
        const registeredOECourses = normalized.filter(course => submittedOECodes.includes(course.code.toUpperCase()));
        const requiredOECredits = oeSlots.rows.reduce((sum: number, row: { credits: string | number }) => sum + Number(row.credits || 0), 0);
        const registeredOECredits = registeredOECourses.reduce((sum, course) => sum + course.credits, 0);
        if (registeredOECourses.length !== oeSlots.rows.length || registeredOECredits !== requiredOECredits) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            code: "NEP_OE_CREDIT_REQUIREMENT",
            message: `Select exactly ${oeSlots.rows.length} Open Elective course(s) carrying ${requiredOECredits} total credits for Semester ${semesterNumber}.`,
          });
        }
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
           AND NOT (ss.semester_id = $3 AND ss.attempt_number = $4)
         LIMIT 1`,
        [resolved.profile.id, submittedOECodes, semesterResult.rows[0].id, attemptNumber],
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
           AND NOT (ss.semester_id = $2 AND ss.attempt_number = $3)
         LIMIT 1`,
        [resolved.profile.id, semesterResult.rows[0].id, attemptNumber],
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
         VALUES ($1, $2, $3, $4, $5, 'REGISTERED', $6, $7::numeric,
                 CASE WHEN $7::numeric > 0::numeric THEN 'PASS' ELSE 'FAIL' END, 'MANUAL_ENTRY', $8)`,
        [semesterRecord.id, curriculumSubject.rows[0]?.id ?? null, course.code || null,
         course.name, course.credits, course.grade || null, course.point, attemptNumber],
      );
    }
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
