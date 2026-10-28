
import { PoolClient } from "pg";
import bcrypt from "bcrypt";
import { pool } from "../../config/database";

export class RegistrationError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

function validateAdminId(value: unknown): string {
  if (typeof value !== "string") {
    throw new RegistrationError("Admin ID is required.");
  }

  const adminId = value.trim();

  if (!/^[A-Za-z0-9_-]{4,32}$/.test(adminId)) {
    throw new RegistrationError(
      "Admin ID must be 4–32 characters and contain only letters, numbers, underscores or hyphens."
    );
  }

  return adminId;
}

function validatePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 12) {
    throw new RegistrationError(
      "Password must contain at least 12 characters."
    );
  }

  if (value.length > 128) {
    throw new RegistrationError("Password is too long.");
  }

  return value;
}

export async function registerApprovedAdmin(
  firebaseUid: string,
  body: Record<string, unknown>
) {
  const adminId = validateAdminId(body.admin_id);
  const password = validatePassword(body.password);

  // Hash before opening the transaction to minimize lock duration.
  const passwordHash = await bcrypt.hash(password, 12);
  const client: PoolClient = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // 1. Verify the authenticated Gradly user.
    const userResult = await client.query(
      `SELECT id, firebase_uid, email, active
       FROM public.users
       WHERE firebase_uid = $1
       LIMIT 1`,
      [firebaseUid]
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new RegistrationError(
        "Gradly user account was not found. Sign in again and retry.",
        403
      );
    }

    if (!user.active) {
      throw new RegistrationError(
        "Your Gradly account is inactive.",
        403
      );
    }

    // 2. Lock the accepted application so concurrent registration
    // attempts cannot register the same application simultaneously.
    const applicationResult = await client.query(
      `SELECT *
       FROM public.admin_applications
       WHERE user_id = $1
         AND status = 'ACCEPTED'
       ORDER BY reviewed_at DESC NULLS LAST
       LIMIT 1
       FOR UPDATE`,
      [user.id]
    );

    const application = applicationResult.rows[0];

    if (!application) {
      throw new RegistrationError(
        "No accepted admin application was found. It may already be registered.",
        403
      );
    }

    // 3. Prevent duplicate registration for this application.
    const existingResult = await client.query(
      `SELECT id
       FROM public.admins
       WHERE application_id = $1
       LIMIT 1`,
      [application.id]
    );

    if (existingResult.rowCount) {
      throw new RegistrationError(
        "This application has already been registered.",
        409
      );
    }

    // 4. This flow currently supports department administrators.
    if (application.requested_role !== "DEPARTMENT_ADMIN") {
      throw new RegistrationError(
        "This application role is not supported by this registration flow.",
        400
      );
    }

    // 5. Use the permissions approved and saved by the Super Admin.
    // Never accept permissions from the registration form.
    const permissions: unknown = application.approved_permissions;

    if (
      !Array.isArray(permissions) ||
      permissions.some(
        (permission: unknown) =>
          typeof permission !== "string" ||
          !permission.trim()
      )
    ) {
      throw new RegistrationError(
        "Approved permissions are invalid. Contact the Super Admin.",
        500
      );
    }

    const approvedPermissions = [
      ...new Set(
        (permissions as string[]).map((permission) =>
          permission.trim()
        )
      )
    ];

    // A department must have been assigned by the Super Admin.
    if (
      typeof application.branch_id !== "string" ||
      !application.branch_id.trim()
    ) {
      throw new RegistrationError(
        "No department has been assigned to this application. Contact the Super Admin.",
        409
      );
    }

    // 6. Create the administrator using the approved institution,
    // department, role, and application details.
    const adminResult = await client.query(
      `INSERT INTO public.admins (
         admin_code,
         admin_username,
         institution_id,
         program_id,
         branch_id,
         full_name,
         email,
         phone_number,
         password_hash,
         role,
         status,
         registration_status,
         registered_at,
         adminship_started_at,
         user_id,
         application_id,
         enrollment_number,
         normalized_enrollment_number,
         password_changed_at,
         password_expires_at,
         created_at,
         updated_at
       )
       VALUES (
         $1, $1, $2, $3, $4, $5, $6, $7, $8,
         'DEPARTMENT_ADMIN',
         'ACTIVE',
         'REGISTERED',
         NOW(),
         NOW(),
         $9,
         $10,
         $11,
         $12,
         NOW(),
         NOW() + INTERVAL '1 month',
         NOW(),
         NOW()
       )
       RETURNING
         id,
         admin_code,
         admin_username,
         institution_id,
         branch_id,
         full_name,
         email,
         role,
         status,
         registration_status,
         registered_at`,
      [
        adminId,
        application.institution_id,
        application.program_id,
        application.branch_id,
        application.full_name,
        application.email,
        application.mobile_number,
        passwordHash,
        user.id,
        application.id,
        application.enrollment_number,
        String(application.enrollment_number)
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "")
      ]
    );

    const admin = adminResult.rows[0];

    // 7. Assign the approved permissions to the newly created admin.
    for (const permissionCode of approvedPermissions) {
      await client.query(
        `INSERT INTO public.admin_permissions (
           admin_id,
           permission_code,
           granted,
           created_at
         )
         VALUES ($1, $2, TRUE, NOW())
         ON CONFLICT DO NOTHING`,
        [admin.id, permissionCode]
      );
    }

    // 8. Record successful registration in the audit log.
    await client.query(
      `INSERT INTO public.audit_logs (
         actor_user_id,
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
         $1,
         'ADMIN',
         'ADMIN_REGISTRATION_COMPLETED',
         'admins',
         $2,
         NULL,
         $3::jsonb,
         $4::jsonb,
         'USER',
         $1,
         NOW()
       )`,
      [
        user.id,
        admin.id,
        JSON.stringify({
          admin_code: admin.admin_code,
          application_id: application.id,
          registration_status: "REGISTERED",
          branch_id: admin.branch_id,
          permissions: approvedPermissions
        }),
        JSON.stringify({
          application_id: application.id
        })
      ]
    );

    // 9. Close the application only after the admin account,
    // approved permissions, and audit log have been written.
    const closedApplication = await client.query(
      `UPDATE public.admin_applications
       SET status = 'REGISTRATION_SUCCESSFUL',
           updated_at = NOW()
       WHERE id = $1
         AND status = 'ACCEPTED'
       RETURNING id`,
      [application.id]
    );

    if (closedApplication.rowCount !== 1) {
      throw new RegistrationError(
        "Could not close the application after registration.",
        409
      );
    }

    // 10. Commit everything together.
    await client.query("COMMIT");
    transactionStarted = false;

    return {
      ...admin,
      application_status: "REGISTRATION_SUCCESSFUL"
    };
  } catch (error: unknown) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Registration transaction rollback failed:",
          rollbackError
        );
      }
    }

    // Map common PostgreSQL uniqueness errors to a helpful response.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new RegistrationError(
        "That Admin ID is already taken, or this application has already been registered.",
        409
      );
    }

    throw error;
  } finally {
    client.release();
  }
}
