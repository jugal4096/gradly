import { pool } from "../../config/database";

export interface SyncUserData {
  firebaseUid: string;
  email: string;
  displayName?: string | null;
}

export async function syncUser(data: SyncUserData) {
  const query = `
    INSERT INTO users (
      firebase_uid,
      email,
      display_name,
      role,
      active,
      last_login_at
    )
    VALUES ($1, $2, $3, 'STUDENT', TRUE, NOW())

    ON CONFLICT (firebase_uid)
    DO UPDATE SET
      email = EXCLUDED.email,
      display_name = COALESCE(users.display_name, EXCLUDED.display_name),
      last_login_at = NOW(),
      updated_at = NOW()

    RETURNING
      id,
      firebase_uid,
      email,
      display_name,
      role,
      active,
      last_login_at,
      created_at,
      updated_at;
  `;

  const values = [
    data.firebaseUid,
    data.email,
    data.displayName ?? null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

/**
 * Resolve Firebase identity to Gradly's internal users.id.
 */
export async function findUserByFirebaseUid(firebaseUid: string) {
  const query = `
    SELECT
      id,
      firebase_uid,
      email,
      display_name,
      role,
      active,
      last_login_at,
      created_at,
      updated_at
    FROM users
    WHERE firebase_uid = $1
    LIMIT 1;
  `;

  const result = await pool.query(query, [firebaseUid]);

  return result.rows[0] ?? null;
}