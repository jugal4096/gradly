import type { Response } from "express";
import { pool } from "../../config/database";
import type { AdminAuthenticatedRequest } from "../../middleware/admin-auth.middleware";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

const types = new Set(["USER_DISABLE","USER_REACTIVATE","USER_DELETE","USER_REVIEW","SYSTEM_CHANGE","BUG_REPORT","FEATURE_REQUEST","CURRICULUM_CHANGE","ACCOUNT_ACCESS","OTHER"]);
const statuses = new Set(["IN_REVIEW","NEEDS_INFO","APPROVED","REJECTED","COMPLETED"]);

export async function createPlatformRequest(req: AdminAuthenticatedRequest, res: Response) {
  const admin = req.admin;
  if (!admin?.adminId) return res.status(401).json({ success:false, message:"Admin authentication required." });
  const { requestType, title, description, targetUserId, priority, metadata } = req.body ?? {};
  if (typeof requestType !== "string" || !types.has(requestType)) return res.status(400).json({success:false,message:"Choose a valid request category."});
  if (typeof title !== "string" || title.trim().length < 4 || title.trim().length > 160) return res.status(400).json({success:false,message:"Title must be 4–160 characters."});
  if (typeof description !== "string" || description.trim().length < 10 || description.trim().length > 5000) return res.status(400).json({success:false,message:"Describe the request in 10–5,000 characters."});
  if (targetUserId !== undefined && targetUserId !== null && (typeof targetUserId !== "string" || targetUserId.trim().length > 100)) return res.status(400).json({success:false,message:"Invalid target user ID."});
  const level = ["LOW","NORMAL","HIGH","URGENT"].includes(priority) ? priority : "NORMAL";
  try {
    const created = await pool.query(
      `INSERT INTO public.platform_requests
       (requester_admin_id,institution_id,program_id,branch_id,request_type,title,description,target_user_id,priority,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       RETURNING id,request_type AS "requestType",title,description,target_user_id AS "targetUserId",priority,status,created_at AS "createdAt"`,
      [admin.adminId,admin.institutionId||null,admin.programId||null,admin.branchId||null,requestType,title.trim(),description.trim(),targetUserId?.trim()||null,level,JSON.stringify(metadata && typeof metadata==="object" && !Array.isArray(metadata) ? metadata : {})]
    );
    const request=created.rows[0];
    await pool.query("INSERT INTO public.platform_request_events(request_id,actor_role,actor_id,event_type,to_status,note) VALUES($1,'ADMIN',$2,'SUBMITTED','PENDING',$3)",[request.id,admin.adminId,description.trim()]);
    return res.status(201).json({success:true,message:"Request submitted to Super Admin.",request});
  } catch(error) {
    console.error("Platform request submission failed:",error);
    return res.status(500).json({success:false,message:"Unable to submit request. Confirm the Request Center migration has been applied."});
  }
}

export async function listAdminPlatformRequests(req: AdminAuthenticatedRequest,res: Response) {
  const adminId=req.admin?.adminId;
  if(!adminId) return res.status(401).json({success:false,message:"Admin authentication required."});
  try {
    const [rows,unread]=await Promise.all([
      pool.query(`SELECT r.id,r.request_type AS "requestType",r.title,r.description,r.target_user_id AS "targetUserId",r.priority,r.status,r.review_note AS "reviewNote",r.created_at AS "createdAt",r.updated_at AS "updatedAt",r.reviewed_at AS "reviewedAt"
       FROM public.platform_requests r WHERE r.requester_admin_id=$1 ORDER BY r.created_at DESC LIMIT 300`,[adminId]),
      pool.query("SELECT COUNT(*)::int AS count FROM public.admin_workspace_notifications WHERE admin_id=$1 AND read_at IS NULL AND notification_type LIKE 'REQUEST_%'",[adminId])
    ]);
    return res.json({success:true,requests:rows.rows,unreadCount:unread.rows[0]?.count||0});
  } catch(error) {
    console.error("Admin platform request list failed:",error);
    return res.status(500).json({success:false,message:"Unable to load your requests. Confirm the Request Center migration has been applied."});
  }
}

export async function listPlatformRequests(req: SuperAdminAuthenticatedRequest,res: Response) {
  if(!req.superAdmin?.superAdminId) return res.status(401).json({success:false,message:"Super Admin authentication required."});
  const status=typeof req.query.status==="string" ? req.query.status : "";
  const type=typeof req.query.type==="string" ? req.query.type : "";
  const search=typeof req.query.search==="string" ? req.query.search.trim().slice(0,120) : "";
  try {
    const values:unknown[]=[]; const where:string[]=[];
    if(status && status!=="ALL"){values.push(status);where.push(`r.status=$${values.length}`);}
    if(type && type!=="ALL"){values.push(type);where.push(`r.request_type=$${values.length}`);}
    if(search){values.push(`%${search}%`);where.push(`(r.title ILIKE $${values.length} OR r.description ILIKE $${values.length} OR a.admin_code ILIKE $${values.length} OR a.full_name ILIKE $${values.length} OR COALESCE(r.target_user_id,'') ILIKE $${values.length})`);}
    const result=await pool.query(
      `SELECT r.id,r.request_type AS "requestType",r.title,r.description,r.target_user_id AS "targetUserId",r.priority,r.status,r.review_note AS "reviewNote",r.acknowledged_at AS "acknowledgedAt",r.created_at AS "createdAt",r.updated_at AS "updatedAt",r.reviewed_at AS "reviewedAt",r.requester_admin_id AS "adminId",a.admin_code AS "adminCode",a.full_name AS "adminName",a.email AS "adminEmail",i.name AS institution,p.name AS program,b.name AS branch
       FROM public.platform_requests r JOIN public.admins a ON a.id=r.requester_admin_id
       LEFT JOIN public.institutions i ON i.id=r.institution_id LEFT JOIN public.programs p ON p.id=r.program_id LEFT JOIN public.branches b ON b.id=r.branch_id
       ${where.length ? "WHERE "+where.join(" AND ") : ""}
       ORDER BY CASE WHEN r.status IN ('PENDING','IN_REVIEW','NEEDS_INFO') THEN 0 ELSE 1 END,r.created_at DESC LIMIT 500`,values);
    const counts=await pool.query(`SELECT COUNT(*) FILTER(WHERE status IN ('PENDING','IN_REVIEW','NEEDS_INFO'))::int AS unattended,
      COUNT(*) FILTER(WHERE acknowledged_at IS NULL AND status IN ('PENDING','IN_REVIEW','NEEDS_INFO'))::int AS unacknowledged,
      COUNT(*) FILTER(WHERE status='PENDING')::int AS pending FROM public.platform_requests`);
    return res.json({success:true,requests:result.rows,counts:counts.rows[0]});
  } catch(error) {
    console.error("Super Admin platform request list failed:",error);
    return res.status(500).json({success:false,message:"Unable to load Request Center. Confirm the Request Center migration has been applied."});
  }
}

export async function reviewPlatformRequest(req: SuperAdminAuthenticatedRequest,res: Response) {
  const superAdminId=req.superAdmin?.superAdminId;
  if(!superAdminId) return res.status(401).json({success:false,message:"Super Admin authentication required."});
  const {status,reviewNote}=req.body??{};
  if(typeof status!=="string" || !statuses.has(status)) return res.status(400).json({success:false,message:"Choose a valid review action."});
  if(typeof reviewNote!=="string" || reviewNote.trim().length<3 || reviewNote.trim().length>2000) return res.status(400).json({success:false,message:"Add a review note between 3 and 2,000 characters."});
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const updated=await client.query(
      `UPDATE public.platform_requests SET status=$2,review_note=$3,reviewed_by=$4,reviewed_at=NOW(),acknowledged_at=COALESCE(acknowledged_at,NOW()),resolved_at=CASE WHEN $2 IN ('REJECTED','COMPLETED') THEN NOW() ELSE resolved_at END,updated_at=NOW()
       WHERE id=$1 AND status IN ('PENDING','IN_REVIEW','NEEDS_INFO','APPROVED') RETURNING id,requester_admin_id AS "adminId",status,title`,
      [req.params.requestId,status,reviewNote.trim(),superAdminId]
    );
    if(!updated.rowCount){await client.query("ROLLBACK");return res.status(404).json({success:false,message:"Open request not found or already closed."});}
    const r=updated.rows[0];
    await client.query("INSERT INTO public.platform_request_events(request_id,actor_role,actor_id,event_type,from_status,to_status,note) VALUES($1,'SUPER_ADMIN',$2,'STATUS_CHANGED',NULL,$3,$4)",[r.id,superAdminId,status,reviewNote.trim()]);
    await client.query("INSERT INTO public.admin_workspace_notifications(admin_id,notification_type,title,message,action_url) VALUES($1,'REQUEST_REVIEW', $2,$3,'/admin/requests')",[r.adminId,`Request update: ${r.title}`,`Status: ${status.replace(/_/g," ")}. ${reviewNote.trim()}`]);
    await client.query("COMMIT");
    return res.json({success:true,message:"Request updated and the requesting Admin has been notified.",request:r});
  } catch(error) {
    await client.query("ROLLBACK");
    console.error("Platform request review failed:",error);
    return res.status(500).json({success:false,message:"Unable to update request."});
  } finally {client.release();}
}

export async function acknowledgePlatformRequest(req: SuperAdminAuthenticatedRequest,res: Response) {
  if(!req.superAdmin?.superAdminId) return res.status(401).json({success:false,message:"Super Admin authentication required."});
  try {
    const result=await pool.query("UPDATE public.platform_requests SET acknowledged_at=COALESCE(acknowledged_at,NOW()),updated_at=NOW() WHERE id=$1 RETURNING id,acknowledged_at AS \"acknowledgedAt\"",[req.params.requestId]);
    if(!result.rowCount) return res.status(404).json({success:false,message:"Request not found."});
    await pool.query("INSERT INTO public.platform_request_events(request_id,actor_role,actor_id,event_type) VALUES($1,'SUPER_ADMIN',$2,'ACKNOWLEDGED')",[req.params.requestId,req.superAdmin.superAdminId]);
    return res.json({success:true,request:result.rows[0]});
  } catch(error) {console.error("Request acknowledgement failed:",error);return res.status(500).json({success:false,message:"Unable to acknowledge request."});}
}
