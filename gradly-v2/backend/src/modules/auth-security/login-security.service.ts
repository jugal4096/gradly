import {
  createLoginSecurityState,
  getLoginSecurityState,
  markLoginSuccess,
  recordLoginAttempt,
  registerFailedLogin,
  resetExpiredLockout,
  notifySecurityLockout,
  type LoginAttemptContext,
  type LoginSecurityState,
  type LoginSecurityUpdate,
  type PrincipalType,
} from "./login-security.repository";

export type { LoginAttemptContext, PrincipalType };

export class LoginLockedError extends Error {
  public readonly lockedUntil: Date | null;

  constructor(lockedUntil: Date | null) {
    super(
      lockedUntil
        ? `Account locked until ${lockedUntil.toISOString()}`
        : "Account temporarily locked."
    );

    this.name = "LoginLockedError";
    this.lockedUntil = lockedUntil;
  }
}

export interface LoginTransactionResult<T> {
  success: boolean;
  lockedUntil: Date | null;
  failedAttempts: number;
  attemptLimit: number;
  lockoutLevel: number;
  result?: T;
}

const NORMAL_ATTEMPT_LIMIT = 3;
const LOCKOUT_DURATION_MS = 12 * 60 * 60 * 1000;

async function ensureLoginAllowed(
  context: LoginAttemptContext
): Promise<LoginSecurityState> {
  if (!context.principalId) {
    throw new Error(
      "A principal ID is required for secure login."
    );
  }

  let state = await getLoginSecurityState(
    context.principalType,
    context.principalId
  );

  if (!state) {
    state = await createLoginSecurityState(
      context.principalType,
      context.principalId
    );
  }

  if (state.locked_until) {
    if (new Date(state.locked_until).getTime() > Date.now()) {
      throw new LoginLockedError(state.locked_until);
    }

    await resetExpiredLockout(
      context.principalType,
      context.principalId
    );

    state = await getLoginSecurityState(
      context.principalType,
      context.principalId
    );

    if (!state) {
      throw new Error(
        "Unable to load login-security state."
      );
    }
  }

  return state;
}

async function handleFailedLogin(
  context: LoginAttemptContext,
  state: LoginSecurityState
): Promise<void> {
  if (!context.principalId) {
    throw new Error("A principal ID is required.");
  }

  const failedAttempts = state.failed_attempts + 1;

  let attemptLimit = state.attempt_limit;
  let lockoutLevel = state.lockout_level;
  let lockedUntil: Date | null = null;

  if (failedAttempts >= 3) {
    lockoutLevel = lockoutLevel + 1;
    attemptLimit = 3;
    lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  } else {
    attemptLimit = 3;
  }

  const update: LoginSecurityUpdate = {
    failedAttempts: lockedUntil ? 0 : failedAttempts,
    attemptLimit,
    lockoutLevel,
    lockedUntil,
  };

  await registerFailedLogin(context.principalType, context.principalId, update);
  await recordLoginAttempt(context, false, "INVALID_CREDENTIALS");

  if (lockedUntil) {
    await notifySecurityLockout(context.principalType, context.principalId, lockedUntil);
  }
}

async function handleSuccessfulLogin(
  context: LoginAttemptContext
): Promise<void> {
  if (!context.principalId) {
    throw new Error("A principal ID is required.");
  }

  await markLoginSuccess(
    context.principalType,
    context.principalId
  );

  await recordLoginAttempt(context, true);
}

export async function executeSecureLogin<T>(
  context: LoginAttemptContext,
  verifyCredentials: () => Promise<T>
): Promise<{
  result: T;
  failedAttempts: number;
  attemptLimit: number;
  lockoutLevel: number;
}> {
  const state = await ensureLoginAllowed(context);

  let result: T;

  try {
    result = await verifyCredentials();
  } catch (error) {
    await handleFailedLogin(context, state);
    throw error;
  }

  await handleSuccessfulLogin(context);

  return {
    result,
    failedAttempts: 0,
    attemptLimit: NORMAL_ATTEMPT_LIMIT,
    lockoutLevel: 0,
  };
}