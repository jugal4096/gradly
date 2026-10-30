import { findAllBranches, findGuestActivity, findGuestSessions, findStudentActivity } from "./user-management.repository";
import { Response } from "express";
import { pool } from "../../config/database";
  
  import {
    getStudentDetails,
    getStudents,
  } from "./user-management.service";
  
  import {
    SuperAdminAuthenticatedRequest,
  } from "../../middleware/super-admin-auth.middleware";
  
  
  export async function listBranches(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.superAdmin) {
      return res.status(401).json({ message: "Super Admin authentication required." });
    }
    const branches = await findAllBranches();
    return res.status(200).json({ branches, count: branches.length });
  } catch (error) {
    console.error("Failed to load branches:", error);
    return res.status(500).json({ message: "Failed to load branches." });
  }
}

export async function listStudents(
    req: SuperAdminAuthenticatedRequest,
    res: Response
  ) {
    try {
      if (!req.superAdmin) {
        return res.status(401).json({
          message:
            "Super Admin authentication required.",
        });
      }
  
      const search =
        typeof req.query.search === "string"
          ? req.query.search
          : undefined;
  
      const students =
        await getStudents(search);
  
      return res.status(200).json({
        students,
        count: students.length,
      });
  
    } catch (error) {
      console.error(
        "Failed to load students:",
        error
      );
  
      return res.status(500).json({
        message:
          "Failed to load student records.",
      });
    }
  }
  
  

  
  export async function listGuests(
    req: SuperAdminAuthenticatedRequest,
    res: Response
  ) {
    try {
      if (!req.superAdmin) {
        return res.status(401).json({
          message: "Super Admin authentication required.",
        });
      }

      const search =
        typeof req.query.search === "string"
          ? req.query.search
          : undefined;
      const guests = await findGuestSessions(search);

      return res.status(200).json({
        guests,
        count: guests.length,
        capped: guests.length === 500,
      });
    } catch (error) {
      console.error("Failed to load guest sessions:", error);
      return res.status(500).json({
        message: "Failed to load guest sessions.",
      });
    }
  }

  export async function getStudent(
    req: SuperAdminAuthenticatedRequest,
    res: Response
  ) {
    try {
      if (!req.superAdmin) {
        return res.status(401).json({
          message:
            "Super Admin authentication required.",
        });
      }
  
      const { userId } = req.params;
  
      if (!userId) {
        return res.status(400).json({
          message:
            "Student user ID is required.",
        });
      }
  
      const result =
        await getStudentDetails(
          userId,
          {
            superAdminId:
              req.superAdmin.superAdminId,
  
            ipAddress:
              req.ip ||
              req.socket.remoteAddress ||
              null,
          }
        );
  
      return res.status(200).json(
        result
      );
  
    } catch (error) {
      console.error(
        "Failed to load student details:",
        error
      );
  
      if (
        error instanceof Error &&
        error.message ===
          "Student account was not found."
      ) {
        return res.status(404).json({
          message: error.message,
        });
      }
  
      return res.status(500).json({
        message:
          "Failed to load student details.",
      });
    }
  }

export async function listStudentActivity(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.superAdmin) {
      return res.status(401).json({ message: "Super Admin authentication required." });
    }
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: "Student user ID is required." });
    const events = await findStudentActivity(userId);
    return res.status(200).json({ events, count: events.length, capped: events.length === 200 });
  } catch (error) {
    console.error("Failed to load student activity:", error);
    return res.status(500).json({ message: "Failed to load student activity." });
  }
}


export async function listGuestActivity(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.superAdmin) return res.status(401).json({ message: "Super Admin authentication required." });
    const { guestId } = req.params;
    if (!guestId) return res.status(400).json({ message: "Guest session ID is required." });
    const events = await findGuestActivity(guestId);
    return res.status(200).json({ events, count: events.length, capped: events.length === 200 });
  } catch (error) {
    console.error("Failed to load guest activity:", error);
    return res.status(500).json({ message: "Failed to load guest activity." });
  }
}


/**
 * Permanently remove a guest profile only after the guest has soft-deleted it.
 * The operation also removes guest-owned audit history and academic workspace rows.
 * A separate Super Admin audit event is written before deleting the guest data.
 */
export async function permanentlyDeleteGuest(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  if (!req.superAdmin?.superAdminId) {
    return res.status(401).json({ message: "Super Admin authentication required." });
  }
  const guestId = req.params.guestId;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT id, metadata FROM guest_sessions WHERE id::text = $1 FOR UPDATE`,
      [guestId]
    );
    const guest = found.rows[0];
    if (!guest) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Guest profile not found. It may already have been permanently deleted." });
    }
    if (!guest.metadata?.deleted_at) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "For safety, the guest must delete their own account before permanent deletion is allowed." });
    }

    await client.query(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata)
       VALUES ('SUPER_ADMIN', $1, 'SUPER_ADMIN', 'SUPER_ADMIN_PERMANENTLY_DELETED_GUEST', 'guest_sessions', $2, $3::jsonb)`,
      [req.superAdmin.superAdminId, guest.id, JSON.stringify({
        guestId: guest.metadata?.guest_id ?? guest.metadata?.display_id ?? null,
        deletedAt: guest.metadata?.deleted_at ?? null,
        permanentDeletion: true,
      })]
    );

    await client.query(
      `DELETE FROM guest_semester_courses
       WHERE guest_semester_id IN (
         SELECT id FROM guest_semesters WHERE guest_session_id = $1::uuid
       )`,
      [guest.id]
    );
    await client.query("DELETE FROM guest_semesters WHERE guest_session_id = $1::uuid", [guest.id]);
    await client.query(
      "DELETE FROM audit_logs WHERE actor_type = 'GUEST' AND actor_id::text = $1::text",
      [guest.id]
    );
    await client.query("DELETE FROM guest_sessions WHERE id = $1::uuid", [guest.id]);
    await client.query("COMMIT");
    return res.status(200).json({ message: "Guest profile and associated guest data were permanently deleted." });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    console.error("Failed to permanently delete guest data:", error);
    return res.status(500).json({ message: "Could not permanently delete guest data." });
  } finally {
    client.release();
  }
}


/** Super Admin can temporarily suspend or restore a student account. */
export async function updateStudentAccountStatus(req: SuperAdminAuthenticatedRequest, res: Response) {
  const superAdminId = req.superAdmin?.superAdminId;
  const userId = String(req.params.userId || "").trim();
  const active = req.body?.active;
  if (!superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  if (!userId || typeof active !== "boolean") return res.status(400).json({ success: false, message: "Provide a user ID and active=true/false." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id, role, active FROM public.users WHERE id::text = $1 FOR UPDATE", [userId]);
    if (!found.rowCount || String(found.rows[0].role).toUpperCase() !== "STUDENT") {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Student account not found." });
    }
    if (Boolean(found.rows[0].active) === active) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: active ? "Account is already active." : "Account is already suspended." });
    }
    const updated = await client.query("UPDATE public.users SET active = $2, updated_at = NOW() WHERE id = $1 RETURNING id, active", [found.rows[0].id, active]);
    await client.query(
      "INSERT INTO public.audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata) VALUES ('SUPER_ADMIN', $1, 'SUPER_ADMIN', $2, 'users', $3, $4::jsonb)",
      [superAdminId, active ? "SUPER_ADMIN_RESTORED_STUDENT_ACCOUNT" : "SUPER_ADMIN_TEMPORARILY_SUSPENDED_STUDENT_ACCOUNT", userId, JSON.stringify({ active, temporary: true })]
    );
    await client.query("COMMIT");
    return res.json({ success: true, message: active ? "Student account restored." : "Student account suspended. Restore it here when the suspension should end.", user: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Student account status update failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update this student account." });
  } finally {
    client.release();
  }
}


/** Return the full institution -> program -> branch catalogue for Super Admin filters. */
export async function listAcademicOptions(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  try {
    const result = await pool.query(`
      SELECT
        i.id::text AS institution_id,
        i.name AS institution_name,
        p.id::text AS program_id,
        p.name AS program_name,
        b.id::text AS branch_id,
        b.name AS branch_name
      FROM public.institutions i
      LEFT JOIN public.programs p ON p.institution_id = i.id
      LEFT JOIN public.branches b ON b.program_id = p.id
      ORDER BY i.name ASC, p.name ASC NULLS FIRST, b.name ASC NULLS FIRST
    `);
    const institutions = new Map<string, {
      id: string;
      name: string;
      programs: Map<string, { id: string; name: string; branches: { id: string; name: string }[] }>;
    }>();
    for (const row of result.rows) {
      if (!institutions.has(row.institution_id)) {
        institutions.set(row.institution_id, { id: row.institution_id, name: row.institution_name, programs: new Map() });
      }
      if (!row.program_id) continue;
      const institution = institutions.get(row.institution_id)!;
      if (!institution.programs.has(row.program_id)) {
        institution.programs.set(row.program_id, { id: row.program_id, name: row.program_name, branches: [] });
      }
      if (row.branch_id) institution.programs.get(row.program_id)!.branches.push({ id: row.branch_id, name: row.branch_name });
    }
    const data = Array.from(institutions.values()).map((institution) => ({
      id: institution.id,
      name: institution.name,
      programs: Array.from(institution.programs.values()),
    }));
    return res.status(200).json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Failed to load academic filter options:", error);
    return res.status(503).json({ success: false, message: "Academic institution, program and branch options could not be loaded." });
  }
}
