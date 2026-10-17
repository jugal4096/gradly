import type { Response } from "express";

import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

export async function getSuperAdminDashboardStats(
  _req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.users)::int
          AS "totalUsers",

        (SELECT COUNT(*) FROM public.admins)::int
          AS "totalAdmins",

        (SELECT COUNT(*) FROM public.institutions)::int
          AS "totalInstitutions",

        (SELECT COUNT(*) FROM public.curriculum_subjects)::int
          AS "totalCourses",

        (
          SELECT COUNT(*)
          FROM public.admin_applications
          WHERE LOWER(TRIM(COALESCE(status, '')))
            IN ('pending', 'submitted', 'under_review', 'under review')
        )::int AS "pendingApplications",

        (
          SELECT COUNT(*)
          FROM public.curriculum_change_requests
          WHERE LOWER(TRIM(COALESCE(status, '')))
            IN ('pending', 'submitted', 'under_review', 'under review')
        )::int AS "pendingCurriculumRequests",

        (
          SELECT COUNT(*)
          FROM public.admins
          WHERE LOWER(TRIM(COALESCE(registration_status, '')))
            IN ('pending', 'submitted', 'under_review', 'under review')
        )::int AS "pendingAdminRequests",

        (
          SELECT COUNT(*)
          FROM public.feedback_requests
          WHERE LOWER(TRIM(COALESCE(status, '')))
            NOT IN ('resolved', 'closed', 'rejected', 'completed', 'cancelled')
            AND status IS NOT NULL
        )::int AS "openFeedback"
    `);

    const stats = statsResult.rows[0];

    let recentActivity: Array<{
      id: string;
      action: string;
      actorRole: string;
      entityTable: string;
      createdAt: string;
    }> = [];

    // Audit history is supplementary; a missing audit table should not
    // prevent the dashboard from displaying otherwise valid statistics.
    try {
      const activityResult = await pool.query(`
        SELECT
          id,
          action,
          actor_role AS "actorRole",
          entity_table AS "entityTable",
          created_at AS "createdAt"
        FROM public.audit_logs
        ORDER BY created_at DESC
        LIMIT 10
      `);

      recentActivity = activityResult.rows;
    } catch (activityError) {
      console.error("Could not load recent Super Admin activity:", activityError);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...stats,
        recentActivity,
      },
    });
  } catch (error) {
    console.error("Error loading Super Admin dashboard statistics:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard statistics.",
    });
  }
}
