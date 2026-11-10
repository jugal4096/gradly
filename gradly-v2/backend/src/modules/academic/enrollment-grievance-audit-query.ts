export type EnrollmentGrievanceAuditFilters = {
  grievanceId?: string;
  reviewerId?: string;
  limit?: number;
};

export function buildEnrollmentGrievanceAuditQuery(filters: EnrollmentGrievanceAuditFilters) {
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters.grievanceId) {
    values.push(filters.grievanceId);
    where.push(`e.grievance_id = $${values.length}`);
  }
  if (filters.reviewerId) {
    values.push(filters.reviewerId);
    where.push(`e.reviewer_id::text = $${values.length}`);
  }
  const requestedLimit = Number(filters.limit);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(Math.floor(requestedLimit), 200)
    : 50;
  values.push(limit);
  return {
    whereSql: where.length ? "WHERE " + where.join(" AND ") : "",
    limitParameter: `$${values.length}`,
    values,
  };
}
