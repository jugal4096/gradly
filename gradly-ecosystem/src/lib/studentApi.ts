import type { User } from "firebase/auth";
import { auth } from "../config/firebase";

export const API_ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api")
  .trim().replace(/\\/+$/, "").replace(/\\/api$/i, "") + "/api";

export async function studentApi<T = Record<string, unknown>>(path: string, init: RequestInit = {}, userOverride?: User): Promise<T> {
  const user = userOverride || auth.currentUser;
  if (!user) throw new Error("Your student session has expired. Please sign in again.");
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + token);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(API_ROOT + (path.startsWith("/") ? path : "/" + path), { ...init, headers });
  const data = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(data.message || "Request failed (" + response.status + ").");
  return data;
}

export async function synchronizeStudent(user: User) {
  return studentApi<{ user: { id: string; active: boolean; display_name: string | null; email: string } }>("/auth/sync", { method: "POST" }, user);
}
