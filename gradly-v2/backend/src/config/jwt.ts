import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from environment variables.");
}

export type AdminTokenPayload = {
  adminId: string;
  adminCode: string;
  role: "DEPARTMENT_ADMIN" | "INSTITUTION_ADMIN";
  institutionId: string;
  programId: string | null;
  branchId: string | null;
};

export type SuperAdminTokenPayload = {
  superAdminId: string;
  adminCode: string;
  role: "SUPER_ADMIN";
};

const JWT_ISSUER = "gradly-api";

export function createAdminToken(payload: AdminTokenPayload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "15m",
    issuer: JWT_ISSUER,
    audience: "gradly-admin",
  });
}

export function createSuperAdminToken(
  payload: SuperAdminTokenPayload
) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "8h",
    issuer: JWT_ISSUER,
    audience: "gradly-super-admin",
  });
}

export function verifyAdminToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: "gradly-admin",
  });

  if (
    typeof decoded === "string" ||
    decoded.role === undefined ||
    !["DEPARTMENT_ADMIN", "INSTITUTION_ADMIN"].includes(
      String(decoded.role)
    )
  ) {
    throw new Error("Invalid Admin token payload.");
  }

  return decoded as unknown as AdminTokenPayload;
}

export function verifySuperAdminToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: "gradly-super-admin",
  });

  if (
    typeof decoded === "string" ||
    decoded.role !== "SUPER_ADMIN" ||
    typeof decoded.superAdminId !== "string" ||
    typeof decoded.adminCode !== "string"
  ) {
    throw new Error("Invalid Super Admin token payload.");
  }

  return decoded as unknown as SuperAdminTokenPayload;
}