import { pool } from "../../config/database";

export type PrincipalType = "ADMIN" | "USER" | "SUPER_ADMIN";

export interface LoginSecurityState {
  id: string;
  principal_type: string;
  principal_id: string;
  failed_attempts: number;
  attempt_limit: number;
  lockout_level: number;
  locked_until: Date | null;
  last_failed_at: Date | null;
  last_success_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LoginAttemptContext {
  principalType: PrincipalType;
  principalId: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprintHash?: string | null;
}

export interface LoginSecurityUpdate {
  failedAttempts: number;
  attemptLimit: number;
  lockoutLevel: number;
  lockedUntil: Date | null;
}

export async function createLoginSecurityState(
  principalType: PrincipalType,
  principalId: string,
  client = pool
): Promise<LoginSecurityState> {
  const query = `
    INSERT INTO login_security (
      principal_type,
      principal_id,
      failed_attempts,
      attempt_limit,
      lockout_level
    )
    VALUES ($1, $2, 0, 3, 0)
    ON CONFLICT (principal_type, principal_id)
    DO UPDATE SET updated_at = login_security.updated_at
    RETURNING *;
  `;

  const result = await client.query<LoginSecurityState>(query, [
    principalType,
    principalId,
  ]);

  return result.rows[0];
}

export async function getLoginSecurityState(
  principalType: PrincipalType,
  principalId: string,
  client = pool
): Promise<LoginSecurityState | null> {
  const query = `
    SELECT *
    FROM login_security
    WHERE principal_type = $1
      AND principal_id = $2
    LIMIT 1;
  `;

  const result = await client.query<LoginSecurityState>(query, [
    principalType,
    principalId,
  ]);

  return result.rows[0] ?? null;
}

export async function getLoginSecurityStateForUpdate(
  principalType: PrincipalType,
  principalId: string,
  client = pool
): Promise<LoginSecurityState | null> {
  const query = `
    SELECT *
    FROM login_security
    WHERE principal_type = $1
      AND principal_id = $2
    FOR UPDATE;
  `;

  const result = await client.query<LoginSecurityState>(query, [
    principalType,
    principalId,
  ]);

  return result.rows[0] ?? null;
}

export async function markLoginSuccess(
  principalType: PrincipalType,
  principalId: string,
  client = pool
): Promise<void> {
  const query = `
    UPDATE login_security
    SET
      failed_attempts = 0,
      locked_until = NULL,
      last_success_at = NOW(),
      updated_at = NOW()
    WHERE principal_type = $1
      AND principal_id = $2;
  `;

  await client.query(query, [principalType, principalId]);
}

export async function registerFailedLogin(
  principalType: PrincipalType,
  principalId: string,
  update: LoginSecurityUpdate,
  client = pool
): Promise<void> {
  const query = `
    UPDATE login_security
    SET
      failed_attempts = $3,
      attempt_limit = $4,
      lockout_level = $5,
      locked_until = $6,
      last_failed_at = NOW(),
      updated_at = NOW()
    WHERE principal_type = $1
      AND principal_id = $2;
  `;

  await client.query(query, [
    principalType,
    principalId,
    update.failedAttempts,
    update.attemptLimit,
    update.lockoutLevel,
    update.lockedUntil,
  ]);
}

export async function resetExpiredLockout(
  principalType: PrincipalType,
  principalId: string,
  client = pool
): Promise<LoginSecurityState | null> {
  const query = `
    UPDATE login_security
    SET
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
    WHERE principal_type = $1
      AND principal_id = $2
      AND locked_until IS NOT NULL
      AND locked_until <= NOW()
    RETURNING *;
  `;

  const result = await client.query<LoginSecurityState>(query, [
    principalType,
    principalId,
  ]);

  return result.rows[0] ?? null;
}

export async function recordLoginAttempt(
  context: LoginAttemptContext,
  success: boolean,
  failureReason: string | null = null,
  client = pool
): Promise<void> {
  const query = `
    INSERT INTO login_attempts (
      principal_type,
      principal_id,
      success,
      ip_address,
      user_agent,
      device_fingerprint_hash,
      failure_reason
    )
    VALUES (
      $1,
      $2,
      $3,
      $4::inet,
      $5,
      $6,
      $7
    );
  `;

  await client.query(query, [
    context.principalType,
    context.principalId,
    success,
    context.ipAddress || null,
    context.userAgent || null,
    context.deviceFingerprintHash || null,
    failureReason,
  ]);
}