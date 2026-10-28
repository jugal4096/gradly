const ADMIN_SESSION_KEYS = [
  "gradly_admin_token",
  "gradly_admin_profile",
  "gradly_admin_permissions",
] as const;

export function clearAdminSession(): void {
  for (const key of ADMIN_SESSION_KEYS) {
    localStorage.removeItem(key);
  }
}
