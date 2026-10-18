import { PoolClient } from "pg";
import { pool } from "../../config/database";

export type ApplicationDecision = "ACCEPTED" | "REJECTED";

export interface ReviewApplicationInput {
  applicationId: string;
  superAdminId: string;
  decision: ApplicationDecision;
  rejectionReason?: string;
  branchId?: string;
  permissions?: string[];
}

export interface SaveApplicationConfigurationInput {
  applicationId: string;
  superAdminId: string;
  branchId: string;
  approvedPermissions: string[];
}

function httpError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

function validatePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw httpError("Permissions must be an array.", 400);
  }

  const permissions: string[] = [];

  for (const permission of value) {
    if (
      typeof permission !== "string" ||
      !/^[A-Z][A-Z0-9_]{1,99}$/.test(permission)
    ) {
      throw httpError("Invalid permission code.", 400);
    }

    permissions.push(permission);
  }

  if (new Set(permissions).size !== permissions.length) {
    throw httpError("Duplicate permissions are not allowed.", 400);
  }

  return permissions;
}

/**
 * List applications for Super Admin review.
 */
export async function listApplications(status?: string) {
  const values: unknown[] = [];
  let statusClause = "";

  if (status) {
    values.push(status);
    statusClause = `WHERE aa.status = $${values.length}`;
  }

  const result = await pool.query(
    `SELECT
       aa.id,
       aa.user_id,
       aa.institution_id,
       aa.program_id,
       aa.branch_id,
       aa.full_name,
       aa.enrollment_number,
       aa.mobile_number,
       aa.email,
       aa.graduation_date,
       aa.qualification,
       aa.requested_role,
       aa.reason,
       aa.additional_note,
       aa.status,
       aa.approved_permissions,
       aa.reviewed_by_super_admin_id,
       aa.reviewed_at,
       aa.rejection_reason,
       aa.created_at,
       aa.updated_at,
       i.name AS institution_name,
       p.name AS program_name,
       b.name AS branch_name
     FROM public.admin_applications aa
     LEFT JOIN public.institutions i
       ON i.id = aa.institution_id
     LEFT JOIN public.programs p
       ON p.id = aa.program_id
     LEFT JOIN public.branches b
       ON b.id = aa.branch_id
     ${statusClause}
     ORDER BY aa.created_at DESC`,
    values
  );

  return result.rows;
}

/**
 * Load active departments belonging to an institution.
 */
export async function listInstitutionBranches(
  institutionId: string
) {
  const result = await pool.query(
    `SELECT
       b.id,
       b.name,
       p.id AS program_id,
       b.code,
       b.active,
       p.name AS program_name
     FROM public.branches b
     JOIN public.programs p
       ON p.id = b.program_id
     WHERE p.institution_id = $1
       AND b.active = TRUE
       AND p.active = TRUE
     ORDER BY p.name, b.name`,
    [institutionId]
  );

  return result.rows;
}

/**
 * Save department and permissions without accepting the application.
 */
export async function saveApplicationConfiguration(
  input: SaveApplicationConfigurationInput
) {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const applicationResult = await client.query(
      `SELECT
         id,
         institution_id,
         branch_id,
         approved_permissions,
         status
       FROM public.admin_applications
       WHERE id = $1
       FOR UPDATE`,
      [input.applicationId]
    );

    if (applicationResult.rowCount !== 1) {
      throw httpError("Application not found.", 404);
    }

    const application = applicationResult.rows[0];

    if (application.status !== "PENDING") {
      throw httpError(
        "Only pending applications can be configured.",
        409
      );
    }

    const permissions = validatePermissions(
      input.approvedPermissions
    );

    if (permissions.length === 0) {
      throw httpError(
        "Select at least one permission.",
        400
      );
    }

    const branchResult = await client.query(
      `SELECT b.id
       FROM public.branches b
       JOIN public.programs p
         ON p.id = b.program_id
       WHERE b.id = $1
         AND p.institution_id = $2
         AND b.active = TRUE
         AND p.active = TRUE
       LIMIT 1`,
      [input.branchId, application.institution_id]
    );

    if (branchResult.rowCount !== 1) {
      throw httpError(
        "The selected department does not belong to this institution or is inactive.",
        400
      );
    }

    const updatedResult = await client.query(
      `UPDATE public.admin_applications
       SET branch_id = $2,
           program_id = (SELECT program_id FROM public.branches WHERE id = $2),
           approved_permissions = $3::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.applicationId,
        input.branchId,
        JSON.stringify(permissions)
      ]
    );

    await client.query(
      `INSERT INTO public.audit_logs (
         actor_role,
         action,
         entity_table,
         entity_id,
         before_data,
         after_data,
         metadata,
         actor_type,
         actor_id,
         created_at
       )
       VALUES (
         'SUPER_ADMIN',
         'ADMIN_APPLICATION_CONFIGURATION_SAVED',
         'admin_applications',
         $1,
         $2::jsonb,
         $3::jsonb,
         $4::jsonb,
         'SUPER_ADMIN',
         $5,
         NOW()
       )`,
      [
        input.applicationId,
        JSON.stringify({
          branch_id: application.branch_id,
          approved_permissions: application.approved_permissions
        }),
        JSON.stringify({
          branch_id: input.branchId,
          approved_permissions: permissions
        }),
        JSON.stringify({
          branch_id: input.branchId,
          approved_permissions: permissions
        }),
        input.superAdminId
      ]
    );

    await client.query("COMMIT");

    return updatedResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Accept or reject a pending application.
 */
export async function reviewApplication(
  input: ReviewApplicationInput
) {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const applicationResult = await client.query(
      `SELECT *
       FROM public.admin_applications
       WHERE id = $1
       FOR UPDATE`,
      [input.applicationId]
    );

    if (applicationResult.rowCount !== 1) {
      throw httpError("Application not found.", 404);
    }

    const application = applicationResult.rows[0];

    if (application.status !== "PENDING") {
      throw httpError(
        "This application has already been reviewed.",
        409
      );
    }

    let branchId: string | null = null;
    let permissions: string[] = [];

    if (input.decision === "ACCEPTED") {
      if (!input.branchId) {
        throw httpError(
          "Select a department before accepting.",
          400
        );
      }

      const branchResult = await client.query(
        `SELECT b.id
         FROM public.branches b
         JOIN public.programs p
           ON p.id = b.program_id
         WHERE b.id = $1
           AND p.institution_id = $2
           AND b.active = TRUE
           AND p.active = TRUE
         LIMIT 1`,
        [input.branchId, application.institution_id]
      );

      if (branchResult.rowCount !== 1) {
        throw httpError(
          "The selected department is invalid for this institution.",
          400
        );
      }

      branchId = input.branchId;
      permissions = validatePermissions(input.permissions);

      if (permissions.length === 0) {
        throw httpError(
          "At least one permission is required.",
          400
        );
      }
    }

    const updatedResult = await client.query(
      `UPDATE public.admin_applications
       SET status = $2,
           branch_id = CASE
             WHEN $2 = 'ACCEPTED' THEN $3::uuid
             ELSE branch_id
           END,
           program_id = CASE
             WHEN $2 = 'ACCEPTED' THEN (SELECT program_id FROM public.branches WHERE id = $3::uuid)
             ELSE program_id
           END,
           reviewed_by_super_admin_id = $4,
           reviewed_at = NOW(),
           rejection_reason = $5,
           approved_permissions = $6::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.applicationId,
        input.decision,
        branchId,
        input.superAdminId,
        input.decision === "REJECTED"
          ? input.rejectionReason?.trim() ||
            "Application rejected."
          : null,
        JSON.stringify(permissions)
      ]
    );

    await client.query(
      `INSERT INTO public.audit_logs (
         actor_role,
         action,
         entity_table,
         entity_id,
         before_data,
         after_data,
         metadata,
         actor_type,
         actor_id,
         created_at
       )
       VALUES (
         'SUPER_ADMIN',
         $1,
         'admin_applications',
         $2,
         $3::jsonb,
         $4::jsonb,
         $5::jsonb,
         'SUPER_ADMIN',
         $6,
         NOW()
       )`,
      [
        `ADMIN_APPLICATION_${input.decision}`,
        input.applicationId,
        JSON.stringify({
          status: application.status,
          branch_id: application.branch_id,
          approved_permissions: application.approved_permissions
        }),
        JSON.stringify({
          status: input.decision,
          branch_id: branchId,
          approved_permissions: permissions,
          reviewed_at: updatedResult.rows[0].reviewed_at
        }),
        JSON.stringify({
          rejection_reason:
            input.decision === "REJECTED"
              ? input.rejectionReason?.trim() ||
                "Application rejected."
              : null
        }),
        input.superAdminId
      ]
    );

    await client.query("COMMIT");

    return updatedResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}