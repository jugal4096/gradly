import { pool } from "../../config/database";

/* =========================================================
   TYPES
   ========================================================= */

export type AdministratorListFilters = {
  institutionId?: string;
  branchId?: string;
  status?: string;
  registrationStatus?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type UpdateAdminStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "DISABLED";

export type AdministratorUpdateResult = {
  id: string;
  admin_code: string;
  admin_username: string | null;
  full_name: string;
  email: string;
  phone_number: string;
  role: string;
  status: string;
  registration_status: string;
  institution_id: string;
  institution_name: string;
  branch_id: string | null;
  branch_name: string | null;
  enrollment_number: string | null;
  adminship_started_at: string | null;
  adminship_expires_at: string | null;
  last_login_at: string | null;
  graduation_date: string | null;
  created_at: string;
  updated_at: string;
};

/* =========================================================
   LIST ADMINISTRATORS
   ========================================================= */

export async function findAdministrators(
  filters: AdministratorListFilters = {}
) {
  const values: unknown[] = [];
  const conditions: string[] = [];

  let parameterIndex = 1;

  if (filters.institutionId) {
    conditions.push(
      `a.institution_id = $${parameterIndex++}`
    );

    values.push(filters.institutionId);
  }

  if (filters.branchId) {
    conditions.push(
      `a.branch_id = $${parameterIndex++}`
    );

    values.push(filters.branchId);
  }

  if (filters.status) {
    conditions.push(
      `a.status = $${parameterIndex++}`
    );

    values.push(filters.status);
  }

  if (filters.registrationStatus) {
    conditions.push(
      `a.registration_status = $${parameterIndex++}`
    );

    values.push(filters.registrationStatus);
  }

  if (filters.search?.trim()) {
    conditions.push(`
      (
        LOWER(a.full_name) LIKE LOWER($${parameterIndex})
        OR LOWER(a.admin_code) LIKE LOWER($${parameterIndex})
        OR LOWER(COALESCE(a.admin_username, '')) LIKE LOWER($${parameterIndex})
        OR LOWER(COALESCE(a.email, '')) LIKE LOWER($${parameterIndex})
        OR LOWER(COALESCE(a.enrollment_number, '')) LIKE LOWER($${parameterIndex})
      )
    `);

    values.push(`%${filters.search.trim()}%`);
    parameterIndex++;
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const limit = Math.min(100, Math.max(1, Math.trunc(filters.limit ?? 25)));
  const offset = Math.min(1000000, Math.max(0, Math.trunc(filters.offset ?? 0)));

  const countResult = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM admins a
    JOIN institutions i ON i.id = a.institution_id
    LEFT JOIN branches b ON b.id = a.branch_id
    ${whereClause}
  `, values);

  const listValues = [...values, limit, offset];
  const limitParameter = listValues.length - 1;
  const offsetParameter = listValues.length;

  const query = `
    SELECT
      a.id,
      a.admin_code,
      a.admin_username,
      a.full_name,
      a.email,
      a.phone_number,
      a.role,
      a.status,
      a.registration_status,

      a.institution_id,
      i.name AS institution_name,

      a.branch_id,
      b.name AS branch_name,

      a.enrollment_number,

      a.adminship_started_at,
      a.adminship_expires_at,

      a.last_login_at,

      a.created_at,
      a.updated_at,

      CASE
        WHEN a.adminship_expires_at IS NULL
          THEN NULL
        ELSE GREATEST(
          0,
          CEIL(
            EXTRACT(
              EPOCH FROM
              (
                a.adminship_expires_at - NOW()
              )
            ) / 86400
          )
        )
      END AS days_until_expiry

    FROM admins a

    JOIN institutions i
      ON i.id = a.institution_id

    LEFT JOIN branches b
      ON b.id = a.branch_id

    ${whereClause}

    ORDER BY
      CASE
        WHEN a.status = 'ACTIVE' THEN 1
        WHEN a.status = 'SUSPENDED' THEN 2
        ELSE 3
      END,
      a.full_name ASC
    LIMIT $${limitParameter}
    OFFSET $${offsetParameter};
  `;

  const result = await pool.query(query, listValues);

  return {
    administrators: result.rows,
    total: Number(countResult.rows[0]?.total ?? 0),
    limit,
    offset,
  };
}

/* =========================================================
   GET ADMINISTRATOR DETAILS
   ========================================================= */

export async function findAdministratorById(
  adminId: string
) {
  const query = `
    SELECT
      a.id,
      a.admin_code,
      a.admin_username,

      a.full_name,
      a.email,
      a.phone_number,

      a.role,
      a.status,
      a.registration_status,

      a.institution_id,
      i.name AS institution_name,

      a.branch_id,
      b.name AS branch_name,

      a.enrollment_number,

      a.adminship_started_at,
      a.adminship_expires_at,

      a.last_login_at,

      a.user_id,

      a.registered_at,
      a.setup_invitation_sent_at,

      a.created_at,
      a.updated_at,

      CASE
        WHEN a.adminship_expires_at IS NULL
          THEN NULL
        ELSE GREATEST(
          0,
          CEIL(
            EXTRACT(
              EPOCH FROM
              (
                a.adminship_expires_at - NOW()
              )
            ) / 86400
          )
        )
      END AS days_until_expiry

    FROM admins a

    JOIN institutions i
      ON i.id = a.institution_id

    LEFT JOIN branches b
      ON b.id = a.branch_id

    WHERE a.id = $1

    LIMIT 1;
  `;

  const result = await pool.query(
    query,
    [adminId]
  );

  return result.rows[0] ?? null;
}

/* =========================================================
   UPDATE ADMIN STATUS
   ========================================================= */

export async function updateAdministratorStatus(
  adminId: string,
  status: UpdateAdminStatus
) {
  const query = `
    UPDATE admins

    SET
      status = $2,
      updated_at = NOW()

    WHERE id = $1

    RETURNING
      id,
      admin_code,
      admin_username,
      full_name,
      email,
      phone_number,
      role,
      status,
      registration_status,
      institution_id,
      branch_id,
      enrollment_number,
      adminship_started_at,
      adminship_expires_at,
      last_login_at,
      created_at,
      updated_at;
  `;

  const result = await pool.query(
    query,
    [adminId, status]
  );

  return result.rows[0] ?? null;
}

/* =========================================================
   CHANGE ADMIN DEPARTMENT / BRANCH
   ========================================================= */

export async function updateAdministratorBranch(
  adminId: string,
  branchId: string
) {
  const query = `
    UPDATE admins

    SET
      branch_id = $2,
      updated_at = NOW()

    WHERE id = $1

    RETURNING
      id,
      admin_code,
      admin_username,
      full_name,
      role,
      status,
      registration_status,
      institution_id,
      branch_id,
      adminship_expires_at,
      updated_at;
  `;

  const result = await pool.query(
    query,
    [adminId, branchId]
  );

  return result.rows[0] ?? null;
}

/* =========================================================
   VALIDATE BRANCH
   ========================================================= */

export async function findBranchForInstitution(
  branchId: string,
  institutionId: string
) {
  const query = `
    SELECT
      b.id,
      b.name,
      p.id AS program_id,
      i.id AS institution_id,
      i.name AS institution_name

    FROM branches b

    JOIN programs p
      ON p.id = b.program_id

    JOIN institutions i
      ON i.id = p.institution_id

    WHERE b.id = $1
      AND i.id = $2

    LIMIT 1;
  `;

  const result = await pool.query(
    query,
    [branchId, institutionId]
  );

  return result.rows[0] ?? null;
}

/* =========================================================
   EXTEND ADMINSHIP
   ========================================================= */

export async function updateAdminshipExpiry(
  adminId: string,
  expiresAt: Date
) {
  const query = `
    UPDATE admins

    SET
      adminship_expires_at = $2,
      updated_at = NOW()

    WHERE id = $1

    RETURNING
      id,
      admin_code,
      admin_username,
      full_name,
      adminship_started_at,
      adminship_expires_at,
      updated_at;
  `;

  const result = await pool.query(
    query,
    [adminId, expiresAt]
  );

  return result.rows[0] ?? null;
}

/* =========================================================
   GET ADMIN GRADUATION DATE
   ========================================================= */

export async function findAdminGraduationDate(
  adminId: string
) {
  const query = `
    SELECT
      a.id,
      a.full_name,
      a.adminship_expires_at,

      COALESCE(
        a.graduation_date,
        NULL
      ) AS graduation_date

    FROM admins a

    WHERE a.id = $1

    LIMIT 1;
  `;

  const result = await pool.query(
    query,
    [adminId]
  );

  return result.rows[0] ?? null;
}

/* =========================================================
   UPDATE GRADUATION DATE
   ========================================================= */

export async function updateAdminGraduationDate(
  adminId: string,
  graduationDate: Date,
  expiresAt: Date
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updateAdminQuery = `
      UPDATE admins

      SET
        graduation_date = $2,
        adminship_expires_at = $3,
        updated_at = NOW()

      WHERE id = $1

      RETURNING
        id,
        admin_code,
        admin_username,
        full_name,
        graduation_date,
        adminship_expires_at,
        updated_at;
    `;

    const result = await client.query(
      updateAdminQuery,
      [
        adminId,
        graduationDate,
        expiresAt,
      ]
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}