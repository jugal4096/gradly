import type { Request, Response } from "express";
import { findAdminAuditEvents, listAdminAuditActions } from "./admin-audit.repository";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

export async function getAdminAuditEvents(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  try {
    const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
    const result = await findAdminAuditEvents({
      adminId: text(req.query.adminId),
      action: text(req.query.action),
      status: text(req.query.status),
      from: text(req.query.from),
      to: text(req.query.to),
      search: text(req.query.search),
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("Failed to load administrator audit events:", error);
    return res.status(500).json({ message: "Failed to load administrator audit events." });
  }
}

export async function getAdminAuditActions(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  try {
    return res.status(200).json({ actions: await listAdminAuditActions() });
  } catch (error) {
    console.error("Failed to load administrator audit action types:", error);
    return res.status(500).json({ message: "Failed to load administrator audit action types." });
  }
}
