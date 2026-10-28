import type { Response } from "express";

import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

export async function getSuperAdminDashboardStats(
  _req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    // Verify which PostgreSQL database the backend is using.
    const databaseResult = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_schema() AS schema_name,
        NOW() AS database_time
    `);

    console.log(
      "✅ Dashboard PostgreSQL connection:",
      databaseResult.rows[0]
    );

    // Fetch actual counts from PostgreSQL.
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
          (SELECT COUNT(*)
           FROM curriculum_change_requests
           WHERE LOWER(TRIM(COALESCE(status, '')))
             IN ('pending', 'submitted', 'under_review', 'under review'))
          +
          (SELECT COUNT(*)
           FROM public.admin_subject_change_requests
           WHERE LOWER(TRIM(COALESCE(status, '')))
             IN ('pending', 'submitted', 'under_review', 'under review'))
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

    console.log("📊 Actual dashboard statistics:", stats);

    // Activity is optional: its failure must not hide valid counts.
    let recentActivity: Array<{
      id: string;
      action: string;
      actorRole: string;
      entityTable: string;
      createdAt: string;
    }> = [];

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
    } catch (activityError) {
      console.error(
        "⚠️ Could not load recent activity:",
        activityError
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        ...stats,
        recentActivity,
      },
    });
  } catch (error) {
    console.error(
      "❌ Error loading Super Admin dashboard statistics:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard statistics.",
    });
  }
}