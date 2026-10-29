import { pool } from "../../config/database";

export const SUPER_ADMIN_LOGIN_FAILURE_LIMIT = 10;

/** Persistent per-IP guard that covers unknown and inactive admin codes as well. */
export async function isSuperAdminLoginRateLimited(ipAddress: string): Promise<boolean> {
  const result = await pool.query<{ failed_attempts: number }>("SELECT COUNT(*)::int AS failed_attempts FROM public.login_attempts WHERE success = FALSE AND ip_address = $1::inet AND created_at >= NOW() - INTERVAL '15 minutes'", [ipAddress]);
  return Number(result.rows[0]?.failed_attempts ?? 0) >= SUPER_ADMIN_LOGIN_FAILURE_LIMIT;
}
