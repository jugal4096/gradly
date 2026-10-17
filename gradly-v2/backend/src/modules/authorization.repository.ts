import { pool } from "../config/database";

export async function hasAdminPermission(
  adminId: string,
  permissionCode: string
) {
  const query = `
    SELECT 1
    FROM admin_permissions
    WHERE admin_id = $1
      AND permission_code = $2
      AND granted = TRUE
    LIMIT 1;
  `;

  const result = await pool.query(query, [
    adminId,
    permissionCode,
  ]);

  return result.rowCount !== null && result.rowCount > 0;
}