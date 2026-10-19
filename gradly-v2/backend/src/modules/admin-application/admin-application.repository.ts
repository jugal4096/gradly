import { PoolClient } from "pg";
import { pool } from "../../config/database";

export interface CreateApplicationInput {
  userId: string;
  institutionId: string;
  programId: string;
  branchId: string;
  specializationId?: string;
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
  institutionId: string,
  programId: string
) {
  const result = await pool.query(
    `SELECT b.id
     FROM public.branches b
     JOIN public.programs p ON p.id = b.program_id
     WHERE b.id = $1
       AND p.institution_id = $2
       AND p.id = $3
     LIMIT 1`,
    [branchId, institutionId, programId]
  );

  return result.rows[0] ?? null;
}

export async function findSpecializationInBranch(
  specializationCode: string,
  programId: string,
  branchId: string
) {
  const result = await pool.query(
    `SELECT sp.id
       FROM public.specializations sp
      WHERE sp.code = $1
        AND sp.program_id = $2
        AND sp.branch_id = $3
        AND sp.active = TRUE
      LIMIT 1`,
    [specializationCode, programId, branchId]
  );
  return result.rows[0] ?? null;
}

export async function findApplicationsForUser(userId: string) {
  const result = await pool.query(
    `SELECT
       aa.id, aa.institution_id, aa.program_id, aa.branch_id, aa.specialization_id, aa.full_name,
       aa.enrollment_number, aa.mobile_number, aa.email, aa.graduation_date,
       aa.qualification, aa.requested_role, aa.reason, aa.additional_note,
       aa.status, aa.reviewed_at, aa.rejection_reason, aa.created_at, aa.updated_at,
       p.name AS program_name, b.name AS branch_name, sp.name AS specialization_name, sp.code AS specialization_code
     FROM public.admin_applications aa
     LEFT JOIN public.programs p ON p.id = aa.program_id
     LEFT JOIN public.branches b ON b.id = aa.branch_id
     LEFT JOIN public.specializations sp ON sp.id = aa.specialization_id
     WHERE aa.user_id = $1
     ORDER BY aa.created_at DESC`,
    [userId]
  );
  return result.rows;
}
export async function findDuplicateApplication(
  userId: string,
  _institutionId: string,
  _branchId: string
) {
  // One Firebase-backed Gradly account may submit only one admin application,
  // regardless of institution, branch, or its current/reviewed status.
  const result = await pool.query(
    `SELECT id, status
     FROM public.admin_applications
     WHERE user_id = $1
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function createApplication(input: CreateApplicationInput) {
  const result = await pool.query(
    `INSERT INTO public.admin_applications (
       user_id, institution_id, program_id, branch_id, specialization_id, full_name, enrollment_number,
       mobile_number, email, graduation_date, qualification, requested_role,
       reason, additional_note, status, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'DEPARTMENT_ADMIN', $12, $13,
       'PENDING', NOW(), NOW()
     ) RETURNING *`,
    [
      input.userId, input.institutionId, input.programId, input.branchId,
      input.specializationId ?? null, input.fullName, input.enrollmentNumber, input.mobileNumber, input.email,
      input.graduationDate, input.qualification ?? null, input.reason ?? null,
      input.additionalNote ?? null
    ]
  );
  return result.rows[0];
}