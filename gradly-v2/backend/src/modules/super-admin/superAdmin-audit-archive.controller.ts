import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

const ensureArchiveTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.super_admin_archived_audit_logs (
      audit_log_id TEXT PRIMARY KEY,
      log_snapshot JSONB NOT NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_by JSONB
    )
  `);
};

export async function archiveSuperAdminAuditLogs(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = [...new Set(rawIds.map((id: unknown) => String(id).trim()).filter(Boolean))];
  const archiveAll = req.body?.all === true;

  if (!archiveAll && ids.length === 0) {
    return res.status(400).json({ success: false, message: "Provide log ids or set all to true." });
  }

  try {
    await ensureArchiveTable();
    const archivedBy = JSON.stringify(req.superAdmin ?? {});
    const result = archiveAll
      ? await pool.query(`
          INSERT INTO public.super_admin_archived_audit_logs
            (audit_log_id, log_snapshot, archived_at, archived_by)
          SELECT a.id::text, to_jsonb(a), NOW(), $1::jsonb
          FROM public.audit_logs a
          ON CONFLICT (audit_log_id) DO NOTHING
          RETURNING audit_log_id
        `, [archivedBy])
      : await pool.query(`
          INSERT INTO public.super_admin_archived_audit_logs
            (audit_log_id, log_snapshot, archived_at, archived_by)
          SELECT a.id::text, to_jsonb(a), NOW(), $2::jsonb
          FROM public.audit_logs a
          WHERE a.id::text = ANY($1::text[])
          ON CONFLICT (audit_log_id) DO NOTHING
          RETURNING audit_log_id
        `, [ids, archivedBy]);

    return res.status(200).json({
      success: true,
      archivedCount: result.rowCount ?? result.rows.length,
      message: "Audit logs archived. Original audit records are preserved.",
    });
  } catch (error) {
    console.error("Failed to archive Super Admin audit logs:", error);
    return res.status(500).json({ success: false, message: "Unable to archive audit logs." });
  }
}


export async function listArchivedSuperAdminAuditLogs(
  _req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    await ensureArchiveTable();
    const result = await pool.query(`
      SELECT audit_log_id AS id, log_snapshot AS "logSnapshot", archived_at AS "archivedAt"
      FROM public.super_admin_archived_audit_logs
      ORDER BY archived_at DESC
      LIMIT 200
    `);
    return res.status(200).json({ success: true, logs: result.rows });
  } catch (error) {
    console.error("Failed to list archived audit logs:", error);
    return res.status(500).json({ success: false, message: "Unable to load archived audit logs." });
  }
}

export async function restoreSuperAdminAuditLog(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const id = String(req.params.logId ?? "").trim();
  if (!id) return res.status(400).json({ success: false, message: "A log id is required." });
  try {
    await ensureArchiveTable();
    // The original audit_logs row is never deleted; restoring simply removes
    // its archive marker so it becomes visible in the active Quick Logs feed.
    const restored = await pool.query(
      "DELETE FROM public.super_admin_archived_audit_logs WHERE audit_log_id = $1 RETURNING audit_log_id",
      [id]
    );
    if (!restored.rowCount) {
      return res.status(404).json({ success: false, message: "Archived log was not found." });
    }
    return res.status(200).json({ success: true, message: "Audit log restored to Quick Logs." });
  } catch (error) {
    console.error("Failed to restore Super Admin audit log:", error);
    return res.status(500).json({ success: false, message: "Unable to restore archived audit log." });
  }
}
