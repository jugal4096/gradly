import { pool } from "../../config/database";

export async function findAdminByCode(adminCode: string) {
  const query = `
    SELECT
      a.id,
      a.admin_code,
      a.institution_id,
      a.branch_id,
      a.program_id,
      a.full_name,
      a.email,
      a.phone_number,
      a.password_hash,
      a.role,
      a.status,
      a.last_login_at,
      a.created_at,
      a.updated_at,
      a.password_changed_at,
      a.password_expires_at,

      i.name AS institution_name,
      b.name AS branch_name,
      p.name AS program_name

    FROM admins a

    JOIN institutions i
      ON i.id = a.institution_id

    LEFT JOIN branches b
      ON b.id = a.branch_id
    LEFT JOIN programs p
      ON p.id = COALESCE(a.program_id, b.program_id)

    WHERE a.admin_code = $1

    LIMIT 1;
  `;

  const result = await pool.query(query, [adminCode]);

  return result.rows[0] ?? null;
}

export async function updateAdminLastLogin(adminId: string) {
  const query = `
    UPDATE admins
    SET
      last_login_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      admin_code,
      full_name,
      role,
      status,
      last_login_at;
  `;

  const result = await pool.query(query, [adminId]);

  return result.rows[0] ?? null;
}

export async function getAdminPermissions(adminId: string) {
  const query = `
    SELECT
      permission_code,
      granted
    FROM admin_permissions
    WHERE admin_id = $1
      AND granted = TRUE
    ORDER BY permission_code;
  `;

  const result = await pool.query(query, [adminId]);

  return result.rows;
}
export async function getAdminWorkspaceProfile(adminId: string) {
  const result = await pool.query(`SELECT a.id, a.admin_code, a.full_name, a.email, a.role, a.status, a.institution_id, i.name AS institution_name, COALESCE(a.program_id, b.program_id) AS program_id, p.name AS program_name, a.branch_id, b.name AS branch_name, a.password_expires_at, a.graduation_completion_date, a.admin_expires_at FROM public.admins a JOIN public.institutions i ON i.id = a.institution_id LEFT JOIN public.branches b ON b.id = a.branch_id LEFT JOIN public.programs p ON p.id = COALESCE(a.program_id, b.program_id) WHERE a.id = $1 LIMIT 1`, [adminId]);
  return result.rows[0] ?? null;
}
