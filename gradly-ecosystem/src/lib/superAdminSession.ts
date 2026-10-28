const TOKEN_KEY = "gradly_super_admin_token";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export type SessionStatus = "valid" | "invalid" | "unreachable";

export async function verifySession(): Promise<SessionStatus> {
  if (!isApiConfigured) return "unreachable";
  const token = getToken();
  if (!token) return "invalid";

  try {
    const response = await fetch(`${API_BASE_URL}/api/super-admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) return "valid";

    if (response.status === 401 || response.status === 403) {
      clearToken();
      return "invalid";
    }

    return "unreachable";
  } catch {
    return "unreachable";
  }
}
