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

export async function findAllBranches() {
  // Match Gradly's academic master-data relationship:
  // Institution -> Program -> Branch. Do not hardcode branch names.
  const result = await pool.query(`
    SELECT DISTINCT
      b.id,
      b.name,
      p.name AS program_name,
      i.name AS institution_name
    FROM institutions i
    INNER JOIN programs p
      ON p.institution_id = i.id
    INNER JOIN branches b
      ON b.program_id = p.id
    ORDER BY
      i.name ASC,
      p.name ASC,
      b.name ASC;
  `);
  return result.rows as Array<{
    id: string;
    name: string;
    program_name: string;
    institution_name: string;
  }>;
}

/** Academic filter options are loaded from master data, not inferred from students. */
export async function findAcademicFilters() {
  const [institutions, programs, branches, schemes] = await Promise.all([
    pool.query(`SELECT id, name FROM institutions ORDER BY name ASC`),
    pool.query(`SELECT id, name, institution_id FROM programs ORDER BY name ASC`),
    pool.query(`SELECT b.id, b.name, b.program_id, p.institution_id
                 FROM branches b
                 INNER JOIN programs p ON p.id = b.program_id
                 ORDER BY b.name ASC`),
    pool.query(`SELECT DISTINCT s.id, s.name
                 FROM schemes s
                 INNER JOIN curricula c ON c.scheme_id = s.id
                 ORDER BY s.name ASC`),
  ]);
  return {
    institutions: institutions.rows,
    programs: programs.rows,
    branches: branches.rows,
    schemes: schemes.rows,
  };
}


/** Deleted student accounts remain visible to Super Admin with their original IDs and academic records. */
export async function findDeletedStudents(search?: string) {
  const result = await pool.query(
    `SELECT
       u.id, u.email, u.display_name, u.role, u.active, u.last_login_at,
       u.created_at, u.updated_at, u.deleted_at,
       sp.id AS student_profile_id, sp.student_identifier,
       sp.current_semester_number, sp.current_cgpa, sp.current_earned_credits,
       sp.admission_year, sp.graduation_year,
       sp.institution_id, c.program_id, c.branch_id, c.scheme_id,
       i.name AS institution_name, p.name AS program_name,
       b.name AS branch_name, s.name AS scheme_name
     FROM public.users u
     LEFT JOIN public.student_profiles sp ON sp.user_id = u.id
     LEFT JOIN public.curricula c ON c.id = sp.curriculum_id
     LEFT JOIN public.institutions i ON i.id = sp.institution_id
     LEFT JOIN public.programs p ON p.id = c.program_id
     LEFT JOIN public.branches b ON b.id = c.branch_id
     LEFT JOIN public.schemes s ON s.id = c.scheme_id
     WHERE u.role = 'STUDENT' AND u.deleted_at IS NOT NULL
       AND ($1::text IS NULL OR u.email ILIKE '%' || $1 || '%'
         OR u.display_name ILIKE '%' || $1 || '%'
         OR u.id::text ILIKE '%' || $1 || '%'
         OR sp.student_identifier ILIKE '%' || $1 || '%')
     ORDER BY u.deleted_at DESC
     LIMIT 1000`,
    [search?.trim() || null]
  );
  return result.rows;
}

/** All disabled, non-deleted accounts across roles for Super Admin recovery. */
export async function findDisabledAccounts(search?: string) {
  const result = await pool.query(
    `SELECT
       u.id, u.email, u.display_name, u.role, u.active, u.last_login_at, u.created_at,
       sp.student_identifier, sp.current_semester_number, sp.current_cgpa,
       sp.institution_id, c.program_id, c.branch_id, c.scheme_id,
       i.name AS institution_name, p.name AS program_name,
       b.name AS branch_name, s.name AS scheme_name
     FROM public.users u
     LEFT JOIN public.student_profiles sp ON sp.user_id = u.id
     LEFT JOIN public.curricula c ON c.id = sp.curriculum_id
     LEFT JOIN public.institutions i ON i.id = sp.institution_id
     LEFT JOIN public.programs p ON p.id = c.program_id
     LEFT JOIN public.branches b ON b.id = c.branch_id
     LEFT JOIN public.schemes s ON s.id = c.scheme_id
     WHERE u.active = FALSE
       AND u.deleted_at IS NULL
       AND (
         $1::text IS NULL
         OR u.email ILIKE '%' || $1 || '%'
         OR u.display_name ILIKE '%' || $1 || '%'
         OR u.id::text ILIKE '%' || $1 || '%'
       )
     ORDER BY u.updated_at DESC NULLS LAST, u.created_at DESC
     LIMIT 1000`,
    [search?.trim() || null]
  );
  return result.rows;
}

export async function findAllStudents(search?: string) {
  const query = `
    SELECT
      u.id,
      u.email,
      u.display_name,
      u.role,
      u.active,
      u.last_login_at,
      u.created_at,

      sp.id AS student_profile_id,
      sp.student_identifier,
      sp.institution_id,
      c.program_id,
      c.branch_id,
      c.scheme_id,
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

    WHERE u.role = 'STUDENT' AND u.deleted_at IS NULL

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
      COALESCE(metadata->>'guest_id', metadata->>'display_id') AS guest_id,
      metadata->>'display_name' AS display_name,
      metadata->>'institution_name' AS institution_name,
      (expires_at IS NULL OR expires_at > NOW()) AS active,
      jsonb_array_length(CASE WHEN jsonb_typeof(metadata->'guest_workspace'->'subjects') = 'array'
        THEN metadata->'guest_workspace'->'subjects' ELSE '[]'::jsonb END) AS subject_count,
      jsonb_array_length(CASE WHEN jsonb_typeof(metadata->'guest_workspace'->'semesters') = 'array'
        THEN metadata->'guest_workspace'->'semesters' ELSE '[]'::jsonb END) AS semester_entry_count
    FROM guest_sessions
    WHERE
      $1::text IS NULL
      OR id::text ILIKE '%' || $1 || '%'
      OR COALESCE(metadata->>'guest_id', metadata->>'display_id') ILIKE '%' || $1 || '%'
      OR metadata->>'display_name' ILIKE '%' || $1 || '%'
      OR metadata->>'institution_name' ILIKE '%' || $1 || '%'
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
      AND u.deleted_at IS NULL

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
     ORDER BY created_at DESC
     LIMIT 200;`,
    [userId]
  );
  return result.rows;
}


export async function findGuestActivity(guestSessionId: string) {
  const result = await pool.query(`
    SELECT id, actor_type, actor_role, action, entity_table, entity_id, created_at, metadata
    FROM audit_logs
    WHERE actor_id::text = $1::text AND actor_type = 'GUEST'
    ORDER BY created_at DESC
    LIMIT 200;
  `, [guestSessionId]);
  return result.rows;
}


/**
 * Permanently remove one guest session and its guest-generated activity records.
 * A separate Super Admin audit event is retained to record the deletion action.
 */
export async function deleteGuestSession(guestSessionId: string, superAdminId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id FROM guest_sessions WHERE id::text = $1 FOR UPDATE`,
      [guestSessionId]
    );
    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `DELETE FROM audit_logs WHERE actor_type = 'GUEST' AND actor_id::text = $1::text`,
      [guestSessionId]
    );
    await client.query(`DELETE FROM guest_sessions WHERE id::text = $1`, [guestSessionId]);
    await client.query(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata)
       VALUES ('SUPER_ADMIN', $1, 'SUPER_ADMIN', 'SUPER_ADMIN_DELETED_GUEST_SESSION',
               'guest_sessions', $2, $3::jsonb)`,
      [superAdminId, guestSessionId, JSON.stringify({ deletedBy: "SUPER_ADMIN" })]
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


/** Change the active state of a registered student without touching academic data. */
export async function updateStudentAccountStatus(
  userId: string,
  active: boolean,
  superAdminId: string,
  ipAddress?: string | null
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE public.users
       SET active = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, active`,
      [userId, active]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      `INSERT INTO public.audit_logs
       (actor_type, actor_id, actor_role, action, entity_table, entity_id, ip_address, metadata)
       VALUES ('SUPER_ADMIN', $1, 'SUPER_ADMIN', $2, 'users', $3, $4, $5::jsonb)`,
      [superAdminId, active ? "SUPER_ADMIN_REACTIVATED_STUDENT" : "SUPER_ADMIN_DISABLED_STUDENT", userId, ipAddress ?? null, JSON.stringify({ active })]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Soft-delete the account; academic records and audit history remain intact. */
export async function softDeleteStudentAccount(
  userId: string,
  superAdminId: string,
  ipAddress?: string | null
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE public.users
       SET active = FALSE, deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW()
       WHERE id = $1 AND role = 'STUDENT' AND deleted_at IS NULL
       RETURNING id`,
      [userId]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `INSERT INTO public.audit_logs
       (actor_type, actor_id, actor_role, action, entity_table, entity_id, ip_address, metadata)
       VALUES ('SUPER_ADMIN', $1, 'SUPER_ADMIN', 'SUPER_ADMIN_SOFT_DELETED_STUDENT', 'users', $2, $3, $4::jsonb)`,
      [superAdminId, userId, ipAddress ?? null, JSON.stringify({ active: false, softDeleted: true })]
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createStudentNotification(
  userId: string,
  superAdminId: string,
  input: { title: string; message: string; notificationType: string; actionUrl?: string | null },
  ipAddress?: string | null
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const recipient = await client.query(
      `SELECT id FROM public.users
       WHERE id = $1 AND role = 'STUDENT' AND active = TRUE AND deleted_at IS NULL
       FOR UPDATE`,
      [userId]
    );
    if (!recipient.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    const inserted = await client.query(
      `INSERT INTO public.student_notifications
       (user_id, notification_type, title, message, action_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, notification_type AS type, title, message, action_url AS "actionUrl", created_at AS "createdAt"`,
      [userId, input.notificationType, input.title, input.message, input.actionUrl ?? null]
    );
    await client.query(
      `INSERT INTO public.audit_logs
       (actor_type, actor_id, actor_role, action, entity_table, entity_id, ip_address, metadata)
       VALUES ('SUPER_ADMIN', $1, 'SUPER_ADMIN', 'SUPER_ADMIN_SENT_STUDENT_NOTIFICATION', 'student_notifications', $2, $3, $4::jsonb)`,
      [superAdminId, inserted.rows[0].id, ipAddress ?? null, JSON.stringify({ recipientUserId: userId, notificationType: input.notificationType })]
    );
    await client.query("COMMIT");
    return inserted.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
