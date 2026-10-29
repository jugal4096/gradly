import type { Response } from "express";

import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

export async function getSuperAdminDashboardStats(
  _req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    // Keep the dashboard aggregation in one database round-trip. Counts are
    // derived from persisted records; unavailable metrics must never be faked.
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.users)::int
          AS "totalUsers",

        (SELECT COUNT(*) FROM admins)::int
          AS "totalAdmins",

        (SELECT COUNT(*) FROM institutions)::int
          AS "totalInstitutions",

        (SELECT COUNT(*) FROM curriculum_subjects)::int
          AS "totalCourses",

        (
          SELECT COUNT(*)
          FROM admin_applications
          WHERE LOWER(TRIM(COALESCE(status, '')))
            IN (
              'pending',
              'submitted',
              'under_review',
              'under review'
            )
        )::int AS "pendingApplications",

        (
          SELECT COUNT(*)
          FROM curriculum_change_requests
          WHERE LOWER(TRIM(COALESCE(status, '')))
            IN (
              'pending',
              'submitted',
              'under_review',
              'under review'
            )
        )::int AS "pendingCurriculumRequests",

        (
          SELECT COUNT(*)
          FROM admins
          WHERE LOWER(TRIM(COALESCE(registration_status, '')))
            IN (
              'pending',
              'submitted',
              'under_review',
              'under review'
            )
        )::int AS "pendingAdminRequests",

        (
          SELECT COUNT(*)
          FROM feedback_requests
          WHERE LOWER(TRIM(COALESCE(status, '')))
            NOT IN (
              'resolved',
              'closed',
              'rejected',
              'completed',
              'cancelled'
            )
            AND status IS NOT NULL
        )::int AS "openFeedback"
    `);

    const stats = statsResult.rows[0];

    // Activity is supplementary. Report its availability explicitly so the
    // client can distinguish an empty feed from an unavailable audit source.
    let recentActivity: Array<{
      id: string;
      action: string;
      actorRole: string;
      entityTable: string;
      createdAt: string;
    }> = [];
    let activityAvailable = true;

    try {
      const activityResult = await pool.query(`
        SELECT
          id,
          action,
          actor_role AS "actorRole",
          entity_table AS "entityTable",
          created_at AS "createdAt"
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 10
      `);

      recentActivity = activityResult.rows;
    } catch {
      activityAvailable = false;
    }

    return res.status(200).json({
      success: true,
      data: {
        ...stats,
        recentActivity,
        activityAvailable,
      },
    });
  } catch {
    // Avoid leaking database details or query information to the client.
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard statistics.",
    });
  }
}
