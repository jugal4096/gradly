import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../config/database";

async function bootstrapSuperAdmin() {
  try {
    console.log("🔐 Starting Super Admin bootstrap...");

    const existing = await pool.query(
      `
      SELECT id, admin_code, status
      FROM super_admins
      ORDER BY created_at ASC
      LIMIT 1;
      `
    );

    if (existing.rows.length > 0) {
      console.log("⚠️ A Super Admin already exists.");
      console.log(`Admin Code: ${existing.rows[0].admin_code}`);
      console.log(`Status: ${existing.rows[0].status}`);
      console.log("❌ Bootstrap stopped for security.");
      return;
    }

    const adminCode = process.env.SUPER_ADMIN_CODE;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const fullName = process.env.SUPER_ADMIN_NAME;
    const email = process.env.SUPER_ADMIN_EMAIL;
    const phoneNumber = process.env.SUPER_ADMIN_PHONE;

    if (!adminCode || !password || !fullName) {
      throw new Error(
        "Missing SUPER_ADMIN_CODE, SUPER_ADMIN_PASSWORD or SUPER_ADMIN_NAME in .env"
      );
    }

    if (password.length < 12) {
      throw new Error(
        "Super Admin password must contain at least 12 characters."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO super_admins (
        admin_code,
        full_name,
        email,
        phone_number,
        password_hash,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
      RETURNING
        id,
        admin_code,
        full_name,
        email,
        phone_number,
        status,
        created_at;
      `,
      [
        adminCode,
        fullName,
        email || null,
        phoneNumber || null,
        passwordHash,
      ]
    );

    console.log("✅ Super Admin created successfully.");
    console.log("");
    console.log("Super Admin:");
    console.log(result.rows[0]);
    console.log("");
    console.log("🔒 Password was stored only as a bcrypt hash.");
    console.log("⚠️ Keep the original password secure.");
  } catch (error) {
    console.error("❌ Super Admin bootstrap failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

bootstrapSuperAdmin();