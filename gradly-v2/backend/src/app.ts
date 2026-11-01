
import express from "express";
import cors from "cors";
import { env } from "./config/env";

// Existing modules
import adminRoutes from "./modules/admin/admin.routes";
import superAdminRoutes from "./modules/super-admin/superAdmin.routes";
import authRoutes from "./modules/auth/auth.routes";
import studentRoutes from "./modules/student/student.routes";
import guestRoutes from "./modules/guest/guest.routes";

// Admin application and registration modules
import adminApplicationRoutes from "./modules/admin-application/admin-application.routes";
import adminAccountSetupRoutes from "./modules/admin-application/admin-account-setup.routes";
import adminRegistrationRoutes from "./modules/admin-registration/admin-registration.routes";
import superAdminApplicationRoutes from "./modules/super-admin/admin-application.routes";

// Academic module
import academicRoutes from "./modules/academic/academic.routes";

// Super Admin → Administrator Management
import administratorRoutes from "./modules/administrator/administrator.routes";
import adminPasswordRequestRoutes from "./modules/admin-password-requests/admin-password-request.routes";

const app = express();

/* =========================================================
   CORS
   ========================================================= */

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);

/* =========================================================
   BODY PARSER
   ========================================================= */

app.use(express.json());

/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Gradly API is running",
  });
});

/* =========================================================
   ACADEMIC MASTER DATA
   ========================================================= */

app.use("/api/academic", academicRoutes);

/* =========================================================
   AUTHENTICATION
   ========================================================= */

app.use("/api/auth", authRoutes);

/* =========================================================
   STUDENT
   ========================================================= */

app.use("/api/student", studentRoutes);

/* =========================================================
   GUEST
   ========================================================= */

app.use("/api/guest", guestRoutes);

/* Guest Mode intentionally exposes generic calculators only; legacy semester-based guest routes are disabled. */

/* =========================================================
   ADMIN APPLICATIONS
   ========================================================= */

// Submit an application and view the applicant's applications.
app.use("/api/admin-applications", adminApplicationRoutes);

// Existing account-setup workflow. Preserve its existing endpoints.
app.use("/api/admin-applications/setup", adminAccountSetupRoutes);

// Complete Admin ID and password registration.
app.use("/api/admin-registration", adminRegistrationRoutes);

// Admin password-change requests, reviewed by Super Admin.
app.use("/api/admin-password-requests", adminPasswordRequestRoutes);

/* =========================================================
   ADMIN
   ========================================================= */

app.use("/api/admin", adminRoutes);

/* =========================================================
   SUPER ADMIN
   ========================================================= */

app.use("/api/super-admin", superAdminRoutes);

// Review admin applications.
app.use(
  "/api/super-admin/applications",
  superAdminApplicationRoutes
);

/* =========================================================
   SUPER ADMIN → ADMINISTRATOR MANAGEMENT
   ========================================================= */

app.use(
  "/api/super-admin/administrators",
  administratorRoutes
);

/* =========================================================
   404 HANDLER
   ========================================================= */

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
   ========================================================= */

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    void _next; // Express requires four arguments for error middleware.
    console.error("Unhandled API error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
);

export default app;
