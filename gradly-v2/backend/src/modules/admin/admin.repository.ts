import { pool } from "../../config/database";

export async function findAdminByCode(adminCode: string) {
  const query = `
    SELECT
      a.id,
      a.admin_code,
      a.institution_id,
      a.branch_id,
      a.full_name,
      a.email,
      a.phone_number,
      a.password_hash,
      a.role,
      a.status,
      a.last_login_at,
      a.created_at,
      a.updated_at,

      i.name AS institution_name,
      b.name AS branch_name

    FROM admins a

    JOIN institutions i
      ON i.id = a.institution_id

    LEFT JOIN branches b
      ON b.id = a.branch_id

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