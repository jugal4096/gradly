const TOKEN_KEY = "gradly_super_admin_token";

import { API_BASE_URL, isApiConfigured } from "./api";
export { API_BASE_URL } from "./api";

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

export type SessionStatus = "valid" | "invalid" | "forbidden" | "unreachable";

export async function verifySession(): Promise<SessionStatus> {
  if (!isApiConfigured) return "unreachable";
  const token = getToken();
  if (!token) return "invalid";

  try {
    const response = await fetch(`${API_BASE_URL}/api/super-admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) return "valid";

    if (response.status === 401) {
      clearToken();
      return "invalid";
    }

    if (response.status === 403) return "forbidden";

    return "unreachable";
  } catch {
    return "unreachable";
  }
}
