import { PoolClient } from "pg";
import { pool } from "../../config/database";

export interface CreateApplicationInput {
  userId: string;
  institutionId: string;
  programId: string;
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
       program_id,
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
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       'DEPARTMENT_ADMIN', $11, $12, 'PENDING', NOW(), NOW()
     )
     RETURNING *`,
    [
      input.userId,
      input.institutionId,
      input.programId,
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