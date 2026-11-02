import type { Response } from "express";
import { pool } from "../../config/database";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

async function resolveStudentId(req: AuthenticatedRequest) {
  const firebaseUid = req.firebaseUser?.uid;
  if (!firebaseUid) return null;
  const result = await pool.query(
    `SELECT id FROM public.users
     WHERE firebase_uid = $1 AND role = 'STUDENT' AND active = TRUE AND deleted_at IS NULL
     LIMIT 1`,
    [firebaseUid]
  );
  return result.rows[0]?.id ?? null;
}

export async function listStudentNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = await resolveStudentId(req);
    if (!userId) return res.status(403).json({ success: false, message: "An active student account is required." });
    const result = await pool.query(
      `SELECT id, notification_type AS type, title, message, action_url AS "actionUrl",
              read_at AS "readAt", created_at AS "createdAt"
       FROM public.student_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId]
    );
    return res.status(200).json({
      success: true,
      notifications: result.rows,
      unreadCount: result.rows.filter((row: { readAt: string | null }) => !row.readAt).length,
    });
  } catch (error) {
    console.error("Student notifications load failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load notifications." });
  }
}

export async function markStudentNotificationRead(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = await resolveStudentId(req);
    if (!userId) return res.status(403).json({ success: false, message: "An active student account is required." });
    const result = await pool.query(
      `UPDATE public.student_notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING id, read_at AS "readAt"`,
      [req.params.notificationId, userId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Notification not found." });
    return res.status(200).json({ success: true, notification: result.rows[0] });
  } catch (error) {
    console.error("Student notification read update failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update notification." });
  }
}
