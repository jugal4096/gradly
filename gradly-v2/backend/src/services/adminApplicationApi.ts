
import { auth } from "../config/firebase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function adminApplicationRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in with Google first.");
  }

  const idToken = await user.getIdToken();

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Request failed.",
    );
  }

  return data as T;
}

export type AdminApplicationInput = {
  institutionId: string;
  branchId: string;
  fullName: string;
  enrollmentNumber: string;
  mobileNumber: string;
  graduationDate: string;
  qualification: string;
  reason: string;
  additionalNote?: string;
};

export function submitAdminApplication(
  input: AdminApplicationInput,
) {
  return adminApplicationRequest(
    "/admin-applications",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function getMyAdminApplications() {
  return adminApplicationRequest<{
    applications: Array<{
      id: string;
      institution_id: string;
      branch_id: string;
      full_name: string;
      email: string;
      graduation_date: string;
      status: string;
      rejection_reason: string | null;
      created_at: string;
    }>;
  }>("/admin-applications/mine");
}
