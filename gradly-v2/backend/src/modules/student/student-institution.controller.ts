import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

export async function requestStudentInstitution(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser?.uid) return res.status(401).json({ message: "Authentication required." });
  const collegeName = typeof req.body?.collegeName === "string" ? req.body.collegeName.trim() : "";
  const locality = typeof req.body?.locality === "string" ? req.body.locality.trim() : "";
  const externalId = typeof req.body?.externalInstitutionId === "string" ? req.body.externalInstitutionId.trim().slice(0, 200) : "";
  if (collegeName.length < 2 || collegeName.length > 160 || locality.length < 2 || locality.length > 160 || /[<>]/.test(collegeName + locality)) {
    return res.status(400).json({ message: "Enter a valid institution name and city or locality." });
  }
  try {
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user) return res.status(404).json({ message: "Gradly account was not found. Sign in again and retry." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["student-institution-request:" + user.id]);
      const pending = await client.query(
        `SELECT id, college_name AS "collegeName", locality, status,
                created_at AS "createdAt", reviewed_at AS "reviewedAt"
         FROM public.guest_institution_requests
         WHERE requested_by_user_id = $1 AND source = 'STUDENT_SETUP'
           AND status IN ('PENDING','IN_REVIEW')
         ORDER BY created_at DESC LIMIT 1`,
        [user.id],
      );
      if (pending.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          code: "INSTITUTION_REQUEST_ALREADY_OPEN",
          message: "You already have an institution request awaiting review. You can submit another request after it is resolved.",
          request: pending.rows[0],
        });
      }
      const result = await client.query(
        `INSERT INTO public.guest_institution_requests
          (college_name, locality, guest_id, external_institution_id, source, status, requested_by_user_id)
         VALUES ($1, $2, NULL, NULLIF($3, ''), 'STUDENT_SETUP', 'PENDING', $4)
         RETURNING id, college_name, locality, status, created_at`,
        [collegeName, locality, externalId, user.id],
      );
      await client.query("COMMIT");
      return res.status(201).json({ message: "Your institution request has been sent to the Super Admin team.", request: result.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Student institution request failed:", error);
    return res.status(503).json({ message: "We couldn't submit your request right now. Please try again later." });
  }
}


export async function listStudentInstitutionRequests(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser?.uid) return res.status(401).json({ message: "Authentication required." });
  try {
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user) return res.status(404).json({ message: "Gradly account was not found." });
    const result = await pool.query(
      `SELECT id, college_name AS "collegeName", locality, status, source,
              created_at AS "createdAt", reviewed_at AS "reviewedAt"
       FROM public.guest_institution_requests
       WHERE requested_by_user_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [user.id],
    );
    return res.json({ success:true, requests:result.rows });
  } catch (error) {
    console.error("Student institution request tracking failed:", error);
    return res.status(500).json({ success:false, message:"Unable to load your institution requests." });
  }
}
