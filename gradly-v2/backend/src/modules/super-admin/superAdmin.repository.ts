import { pool } from "../../config/database";

export async function findSuperAdminByCode(
  adminCode: string
) {
  const query = `
    SELECT
      id,
      admin_code,
      full_name,
      email,
      phone_number,
      password_hash,
      status,
      last_login_at,
      created_at,
      updated_at
    FROM super_admins
    WHERE admin_code = $1
    LIMIT 1;
  `;

  const result = await pool.query(query, [adminCode]);

  return result.rows[0] ?? null;
}

export async function updateSuperAdminLastLogin(
  id: string
) {
  const query = `
    UPDATE super_admins
    SET
      last_login_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      admin_code,
      full_name,
      status,
      last_login_at;
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] ?? null;
}