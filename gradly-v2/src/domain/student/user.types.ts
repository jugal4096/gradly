export type UserRole =
  | "STUDENT"
  | "ADMIN"
  | "SUPER_ADMIN";

export interface User {
  id: string;

  email: string;

  displayName?: string;

  role: UserRole;

  active: boolean;

  createdAt: string;
  updatedAt: string;
}