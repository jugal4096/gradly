import { pool } from "../../config/database";

export interface CreateApplicationInput {
  userId: string;
  institutionId: string;
  branchId: string;
  fullName: string;
  enrollmentNumber: string;
  mobileNumber: string;
  email: string;
  graduationDate: string;
  qualification?: string;
  reason?: string;
  additionalNote?: string;
}

export async function findUserByFirebaseUid(firebaseUid: string) {
  const result = await pool.query(
    `SELECT id, firebase_uid, email, display_name, active
     FROM public.users
     WHERE firebase_uid = $1
     LIMIT 1`,
    [firebaseUid]
  );

  return result.rows[0] ?? null;
}

export async function findBranchInInstitution(
  branchId: string,
  institutionId: string
) {
  const result = await pool.query(
    `SELECT b.id
     FROM public.branches b
     JOIN public.programs p ON p.id = b.program_id
     WHERE b.id = $1
       AND p.institution_id = $2
     LIMIT 1`,
    [branchId, institutionId]
  );

  return result.rows[0] ?? null;
}

export async function findApplicationsForUser(userId: string) {
  const result = await pool.query(
    `SELECT
       id,
       institution_id,
       branch_id,
       full_name,
       enrollment_number,
       mobile_number,
       email,
       graduation_date,
       qualification,
       requested_role,
       reason,
       additional_note,
       status,
       reviewed_at,
       rejection_reason,
       created_at,
       updated_at
     FROM public.admin_applications
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

export async function findDuplicateApplication(
  userId: string,
  institutionId: string,
  branchId: string
) {
  const result = await pool.query(
    `SELECT id, status
     FROM public.admin_applications
     WHERE user_id = $1
       AND institution_id = $2
       AND branch_id = $3
       AND status IN ('PENDING', 'ACCEPTED')
     LIMIT 1`,
    [userId, institutionId, branchId]
  );

  return result.rows[0] ?? null;
}

export async function createApplication(input: CreateApplicationInput) {
  const result = await pool.query(
    `INSERT INTO public.admin_applications (
       user_id,
       institution_id,
       branch_id,
       full_name,
       enrollment_number,
       mobile_number,
       email,
       graduation_date,
       qualification,
       requested_role,
       reason,
       additional_note,
       status,
       created_at,
       updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9,
       'DEPARTMENT_ADMIN', $10, $11, 'PENDING', NOW(), NOW()
     )
     RETURNING *`,
    [
      input.userId,
      input.institutionId,
      input.branchId,
      input.fullName,
      input.enrollmentNumber,
      input.mobileNumber,
      input.email,
      input.graduationDate,
      input.qualification ?? null,
      input.reason ?? null,
      input.additionalNote ?? null
    ]
  );

  return result.rows[0];
}

export interface AdminAuditLogInput {
  superAdminId: string;
  action: string;
  entityTable: string;
  entityId: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createAdminAuditLog(input: AdminAuditLogInput) {
  const metadata = {
    ...(input.metadata ?? {}),
    ipAddress: input.ipAddress ?? null,
  };

  const result = await pool.query(
    `
      INSERT INTO public.audit_logs (
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
        $2,
        $3,
        NULL,
        NULL,
        $4::jsonb,
        'SUPER_ADMIN',
        $5,
        NOW()
      )
      RETURNING id;
    `,
    [
      input.action,
      input.entityTable,
      input.entityId,
      JSON.stringify(metadata),
      input.superAdminId,
    ]
  );

  return result.rows[0] ?? null;
}
