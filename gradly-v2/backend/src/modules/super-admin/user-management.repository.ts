import { pool } from "../../config/database";

/*
 * IMPORTANT:
 * These queries intentionally do NOT select:
 * - password_hash
 * - Firebase credentials
 * - session tokens
 *
 * This module is read-only administrative inspection.
 */

export async function findAllStudents(search?: string) {
  const query = `
    SELECT
      u.id,
      u.display_name,
      u.role,
      u.active,
      u.last_login_at,
      u.created_at,

      sp.id AS student_profile_id,
      sp.admission_year,
      sp.current_semester_number,
      sp.graduation_year,
      sp.target_cgpa,
      sp.current_cgpa,
      sp.current_earned_credits,

      i.name AS institution_name,
      p.name AS program_name,
      b.name AS branch_name,
      s.name AS scheme_name

    FROM users u

    LEFT JOIN student_profiles sp
      ON sp.user_id = u.id

    LEFT JOIN institutions i
      ON i.id = sp.institution_id

    LEFT JOIN curricula c
      ON c.id = sp.curriculum_id

    LEFT JOIN programs p
      ON p.id = c.program_id

    LEFT JOIN branches b
      ON b.id = c.branch_id

    LEFT JOIN schemes s
      ON s.id = c.scheme_id

    WHERE u.role = 'STUDENT'

      AND (
        $1::text IS NULL
        OR u.display_name ILIKE '%' || $1 || '%'
        OR u.email ILIKE '%' || $1 || '%'
        OR sp.student_identifier ILIKE '%' || $1 || '%'
        OR b.name ILIKE '%' || $1 || '%'
      )

    ORDER BY
      u.created_at DESC;
  `;

  const result = await pool.query(query, [
    search?.trim() || null,
  ]);

  return result.rows;
}



/**
 * Read-only guest-session directory for Super Admins.
 * Never return the stored token hash or any raw session token.
 */
export async function findGuestSessions(search?: string) {
  const query = `
    SELECT
      id,
      first_seen_at,
      last_seen_at,
      expires_at,
      metadata,
      (expires_at IS NULL OR expires_at > NOW()) AS active
    FROM guest_sessions
    WHERE
      $1::text IS NULL
      OR id::text ILIKE '%' || $1 || '%'
    ORDER BY last_seen_at DESC NULLS LAST
    LIMIT 500;
  `;

  const result = await pool.query(query, [search?.trim() || null]);
  return result.rows;
}

export async function findStudentById(
  userId: string
) {
  const query = `
    SELECT
      u.id,
      u.display_name,
      u.role,
      u.active,
      u.last_login_at,
      u.created_at,
      u.updated_at,

      sp.id AS student_profile_id,
      sp.admission_year,
      sp.current_semester_number,
      sp.graduation_year,
      sp.target_cgpa,
      sp.current_cgpa,
      sp.current_earned_credits,

      i.id AS institution_id,
      i.name AS institution_name,

      p.id AS program_id,
      p.name AS program_name,

      b.id AS branch_id,
      b.name AS branch_name,

      s.id AS scheme_id,
      s.name AS scheme_name,

      c.id AS curriculum_id

    FROM users u

    LEFT JOIN student_profiles sp
      ON sp.user_id = u.id

    LEFT JOIN institutions i
      ON i.id = sp.institution_id

    LEFT JOIN curricula c
      ON c.id = sp.curriculum_id

    LEFT JOIN programs p
      ON p.id = c.program_id

    LEFT JOIN branches b
      ON b.id = c.branch_id

    LEFT JOIN schemes s
      ON s.id = c.scheme_id

    WHERE
      u.id = $1
      AND u.role = 'STUDENT'

    LIMIT 1;
  `;

  const result = await pool.query(
    query,
    [userId]
  );

  return result.rows[0] ?? null;
}


export async function findStudentSemesters(
  userId: string
) {
  const query = `
    SELECT
      ss.id,
      ss.attempt_number,
      ss.status,
      ss.result_publication_status,
      ss.result_source,
      ss.verified,
      ss.credits_registered,
      ss.credits_earned,
      ss.sgpa,
      ss.sgpa_calculated_at,
      ss.result_declared_at,

      sem.id AS semester_id,
      sem.semester_number,
      sem.name AS semester_name

    FROM student_semesters ss

    JOIN student_profiles sp
      ON sp.id = ss.student_profile_id

    JOIN semesters sem
      ON sem.id = ss.semester_id

    WHERE sp.user_id = $1

    ORDER BY
      sem.semester_number ASC,
      ss.attempt_number ASC;
  `;

  const result = await pool.query(
    query,
    [userId]
  );

  return result.rows;
}


export async function findSemesterCourses(
  studentSemesterId: string
) {
  const query = `
    SELECT
      ssc.id,
      ssc.curriculum_subject_id,

      ssc.course_code_snapshot,
      ssc.course_name_snapshot,

      ssc.credits,
      ssc.registration_status,

      ssc.grade_symbol,
      ssc.grade_point,

      ssc.marks,
      ssc.maximum_marks,

      ssc.result_status,
      ssc.result_source,
      ssc.verified,

      ssc.attempt_number

    FROM student_semester_courses ssc

    WHERE
      ssc.student_semester_id = $1

    ORDER BY
      ssc.course_name_snapshot ASC;
  `;

  const result = await pool.query(
    query,
    [studentSemesterId]
  );

  return result.rows;
}


export async function createAuditLog(params: {
  actorType: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityTable: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  await pool.query(
    `
      INSERT INTO audit_logs (
        actor_type,
        actor_id,
        actor_role,
        action,
        entity_table,
        entity_id,
        ip_address,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      );
    `,
    [
      params.actorType,
      params.actorId,
      params.actorRole,
      params.action,
      params.entityTable,
      params.entityId,
      params.ipAddress ?? null,
      params.metadata ?? {},
    ]
  );
}

/**
 * Read-only timeline of audit events associated with a student account.
 * This only returns events actually recorded by the application; it does not
 * infer page views or activity that was never instrumented.
 */
export async function findStudentActivity(userId: string) {
  const result = await pool.query(
    `SELECT id, actor_type, actor_role, action, entity_table, entity_id, created_at, metadata
     FROM audit_logs
     WHERE actor_id::text = $1::text
        OR (entity_table = 'users' AND entity_id::text = $1::text)
     ORDER BY created_at DESC
     LIMIT 200;`,
    [userId]
  );
  return result.rows;
}
