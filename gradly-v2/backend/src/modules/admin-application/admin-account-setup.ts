import crypto from "crypto";

/* =========================================================
   ADMIN ACCOUNT SETUP TOKEN
   ========================================================= */

/*
 * Generates a cryptographically secure random token.
 *
 * The raw token is returned only to the service layer.
 * Only the SHA-256 hash is stored in PostgreSQL.
 */
export function generateAdminSetupToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const tokenHash = hashAdminSetupToken(rawToken);

  return {
    rawToken,
    tokenHash,
  };
}

/* =========================================================
   HASH SETUP TOKEN
   ========================================================= */

/*
 * Deterministic SHA-256 hash.
 *
 * We never store the raw setup token in the database.
 */
export function hashAdminSetupToken(
  token: string
) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}