import { PoolClient } from "pg";
import { pool } from "../../config/database";

export async function findAdminByCodeForManagement(
  adminCode: string
) {
  const result = await pool.query(
    `
    SELECT
      id,
      admin_code,
      institution_id,
      branch_id,
      full_name,
      email,
      phone_number,
      role,
      status
    FROM admins
    WHERE admin_code = $1
    LIMIT 1;
    `,
    [adminCode]
  );

  return result.rows[0] ?? null;
}

export async function findInstitutionById(
  institutionId: string
) {
  const result = await pool.query(
    `
    SELECT
      id,
      name
    FROM institutions
    WHERE id = $1
    LIMIT 1;
    `,
    [institutionId]
  );

  return result.rows[0] ?? null;
}

export async function findBranchById(
  branchId: string
) {
  const result = await pool.query(
    `
    SELECT
      b.id,
      b.name,
      b.program_id,
      p.institution_id
    FROM branches b
    JOIN programs p
      ON p.id = b.program_id
    WHERE b.id = $1
    LIMIT 1;
    `,
    [branchId]
  );

  return result.rows[0] ?? null;
}

export async function createAdmin(
  client: PoolClient,
  adminCode: string,
  institutionId: string,
  branchId: string | null,
  fullName: string,
  email: string | null,
  phoneNumber: string | null,
  passwordHash: string,
  role: string
) {
  const result = await client.query(
    `
    INSERT INTO admins (
      admin_code,
      institution_id,
      branch_id,
      full_name,
      email,
      phone_number,
      password_hash,
      role,
      status,
      password_changed_at,
      password_expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), NOW() + INTERVAL '1 month')
    RETURNING
      id,
      admin_code,
      institution_id,
      branch_id,
      full_name,
      email,
      phone_number,
      role,
      status,
      created_at;
    `,
    [
      adminCode,
      institutionId,
      branchId,
      fullName,
      email,
      phoneNumber,
      passwordHash,
      role,
    ]
  );

  return result.rows[0];
}

export async function addAdminPermission(
  client: PoolClient,
  adminId: string,
  permissionCode: string
) {
  await client.query(
    `
    INSERT INTO admin_permissions (
      admin_id,
      permission_code,
      granted
    )
    VALUES ($1, $2, TRUE)
    ON CONFLICT (admin_id, permission_code)
    DO UPDATE SET granted = TRUE;
    `,
    [adminId, permissionCode]
  );
}

export async function getAdminPermissionsForManagement(
  adminId: string
) {
  const result = await pool.query(
    `
    SELECT
      permission_code,
      granted
    FROM admin_permissions
    WHERE admin_id = $1
    ORDER BY permission_code;
    `,
    [adminId]
  );

  return result.rows;
}