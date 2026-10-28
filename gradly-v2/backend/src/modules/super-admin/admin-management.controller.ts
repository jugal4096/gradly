import { Request, Response } from "express";
import { provisionAdmin } from "./admin-management.service";

export async function createAdmin(req: Request, res: Response) {
  try {
    const {
      adminCode,
      institutionId,
      branchId,
      fullName,
      email,
      phoneNumber,
      password,
      role,
      permissions,
    } = req.body;

    if (
      typeof adminCode !== "string" ||
      typeof institutionId !== "string" ||
      typeof fullName !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string" ||
      !Array.isArray(permissions)
    ) {
      return res.status(400).json({
        message:
          "adminCode, institutionId, fullName, password, role and permissions are required.",
      });
    }

    if (role !== "DEPARTMENT_ADMIN" && role !== "INSTITUTION_ADMIN") {
      return res.status(400).json({
        message: "Role must be DEPARTMENT_ADMIN or INSTITUTION_ADMIN.",
      });
    }

    const result = await provisionAdmin({
      adminCode: adminCode.trim(),
      institutionId: institutionId.trim(),
      branchId:
        typeof branchId === "string" && branchId.trim()
          ? branchId.trim()
          : null,
      fullName: fullName.trim(),
      email:
        typeof email === "string" && email.trim()
          ? email.trim()
          : null,
      phoneNumber:
        typeof phoneNumber === "string" && phoneNumber.trim()
          ? phoneNumber.trim()
          : null,
      password,
      role,
      permissions,
    });

    return res.status(201).json({
      message: "Admin created successfully.",
      ...result,
    });
  } catch (error) {
    console.error("Admin provisioning failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create admin.";

    return res.status(400).json({
      message,
    });
  }
}