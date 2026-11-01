import { pool } from "../../config/database";

export interface AdminAuditFilters {
  adminId?: string;
  action?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function findAdminAuditEvents(filters: AdminAuditFilters = {}) {
  const values: unknown[] = [];
  const where: string[] = [
    "(LOWER(COALESCE(al.actor_role, '')) LIKE '%admin%' OR LOWER(COALESCE(al.actor_type, '')) = 'admin' OR LOWER(COALESCE(al.actor_type, '')) = 'administrator')",
  ];
  const add = (value: unknown) => { values.push(value); return `$${values.length}`; };

  if (filters.adminId) where.push(`al.actor_id::text = ${add(filters.adminId)}`);
  if (filters.action) where.push(`al.action = ${add(filters.action)}`);
  if (filters.from) where.push(`al.created_at >= ${add(filters.from)}::timestamptz`);
  if (filters.to) where.push(`al.created_at < (${add(filters.to)}::date + INTERVAL '1 day')`);
  if (filters.search) {
    const p = add(`%${filters.search}%`);
    where.push(`(COALESCE(al.action,'') ILIKE ${p} OR COALESCE(al.entity_table,'') ILIKE ${p} OR COALESCE(al.entity_id::text,'') ILIKE ${p} OR COALESCE(al.metadata::text,'') ILIKE ${p})`);
  }
  if (filters.status) {
    const p = add(`%${filters.status}%`);
    where.push(`(COALESCE(al.action,'') ILIKE ${p} OR COALESCE(al.metadata::text,'') ILIKE ${p} OR COALESCE(al.after_data::text,'') ILIKE ${p})`);
  }
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const limitParam = add(limit);
  const offsetParam = add(offset);
  const result = await pool.query(
    `SELECT al.id, al.actor_type, al.actor_id, al.actor_role, al.action,
            al.entity_table, al.entity_id, al.before_data, al.after_data,
            al.metadata, al.created_at,
            a.full_name AS administrator_name, a.admin_code,
            a.branch_id, b.name AS branch_name, i.name AS institution_name
     FROM public.audit_logs al
     LEFT JOIN public.admins a ON a.id::text = al.actor_id::text
     LEFT JOIN public.branches b ON b.id = a.branch_id
     LEFT JOIN public.institutions i ON i.id = a.institution_id
     WHERE ${where.join(" AND ")}
     ORDER BY al.created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values
  );
  const countValues = values.slice(0, values.length - 2);
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM public.audit_logs al WHERE ${where.join(" AND ")}`,
    countValues
  );
  return { events: result.rows, total: count.rows[0]?.total ?? 0, limit, offset };
}

export async function listAdminAuditActions() {
  const result = await pool.query(
    `SELECT DISTINCT al.action FROM public.audit_logs al
     WHERE (LOWER(COALESCE(al.actor_role, '')) LIKE '%admin%' OR LOWER(COALESCE(al.actor_type, '')) IN ('admin','administrator'))
       AND al.action IS NOT NULL ORDER BY al.action`
  );
  return result.rows.map((row) => row.action as string);
}
