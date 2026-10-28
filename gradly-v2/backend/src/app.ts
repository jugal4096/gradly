
import express from "express";
import cors from "cors";

// Existing modules
import adminRoutes from "./modules/admin/admin.routes";
import superAdminRoutes from "./modules/super-admin/superAdmin.routes";
import authRoutes from "./modules/auth/auth.routes";
import studentRoutes from "./modules/student/student.routes";
import guestRoutes from "./modules/guest/guest.routes";
import guestAcademicRoutes from "./modules/guest/guest.academic.routes";

// Admin application and registration modules
import adminApplicationRoutes from "./modules/admin-application/admin-application.routes";
import adminAccountSetupRoutes from "./modules/admin-application/admin-account-setup.routes";
import adminRegistrationRoutes from "./modules/admin-registration/admin-registration.routes";
import superAdminApplicationRoutes from "./modules/super-admin/admin-application.routes";

// Academic module
import academicRoutes from "./modules/academic/academic.routes";

// Super Admin → Administrator Management
import administratorRoutes from "./modules/administrator/administrator.routes";

const app = express();

/* =========================================================
   CORS
   ========================================================= */

const configuredFrontendOrigins = (process.env.FRONTEND_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const isAllowedFrontendOrigin = (origin: string) =>
  configuredFrontendOrigins.includes(origin) ||
  /^https?:\/\/(localhost|127\.0\.0\.1):(5173|5174|4173)$/.test(origin) ||
  origin === "https://gradly.vercel.app" ||
  origin === "https://gradly-peach.vercel.app" ||
  origin === "https://gradly-reach.vercel.app" ||
  /^https:\/\/gradly(?:-[a-z0-9-]+)?-jugal4096s-projects\.vercel\.app$/.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser health checks and server-to-server requests.
      callback(null, !origin || isAllowedFrontendOrigin(origin));
    },
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

/* =========================================================
   GUEST ACADEMIC
   ========================================================= */

app.use("/api/guest/academic", guestAcademicRoutes);

/* =========================================================
   ADMIN APPLICATIONS
   ========================================================= */

// Submit an application and view the applicant's applications.
app.use("/api/admin-applications", adminApplicationRoutes);

// Existing account-setup workflow. Preserve its existing endpoints.
app.use("/api/admin-applications/setup", adminAccountSetupRoutes);

// Complete Admin ID and password registration.
app.use("/api/admin-registration", adminRegistrationRoutes);

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
    void _next;
    console.error("Unhandled API error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
);

export default app;
