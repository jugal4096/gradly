import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

// =====================================================
// ECOSYSTEM
// =====================================================

import EcosystemEntry from "./pages/entry/EcosystemEntry";

// =====================================================
// ADMIN
// =====================================================

import AdminRegister from "./pages/admin/AdminRegister";
import AdminPortal from "./pages/admin/AdminPortal";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminApply from "./pages/admin/AdminApply";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminWorkspacePage from "./pages/admin/AdminWorkspacePage";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminChangePassword from "./pages/admin/AdminChangePassword";
import StudentSyllabusFeedbackPage from "./pages/student/StudentSyllabusFeedbackPage";
import StudentLogin from "./pages/student/StudentLogin";
import StudentProfile from "./pages/student/StudentProfile";
import StudentDashboard from "./pages/student/StudentDashboard";

// =====================================================
// SUPER ADMIN
// =====================================================

import SuperAdminLogin from "./pages/super-admin/SuperAdminLogin";
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import RequireSuperAdmin from "./components/RequireSuperAdmin";

import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import SuperAdminUsers from "./pages/super-admin/SuperAdminUsers";
import SuperAdminUserDetails from "./pages/super-admin/SuperAdminUserDetails";
import SuperAdminApplications from "./pages/super-admin/SuperAdminApplications";
import SuperAdminAudit from "./pages/super-admin/SuperAdminAudit";
import SuperAdminAdmins from "./pages/super-admin/SuperAdminAdmins";
import SuperAdminFeedback from "./pages/super-admin/SuperAdminFeedback";
import SuperAdminInstitutions from "./pages/super-admin/SuperAdminInstitutions";
import SuperAdminInstitutionCreate from "./pages/super-admin/SuperAdminInstitutionCreate";
import SuperAdminCurriculum from "./pages/super-admin/SuperAdminCurriculum";
import SuperAdminSettings from "./pages/super-admin/SuperAdminSettings";
import SuperAdminPasswordRequests from "./pages/super-admin/SuperAdminPasswordRequests";
import SuperAdminSecurityAlerts from "./pages/super-admin/SuperAdminSecurityAlerts";
import SuperAdminAdminMessages from "./pages/super-admin/SuperAdminAdminMessages";
import SuperAdminAdminRequests from "./pages/super-admin/SuperAdminAdminRequests";

// =====================================================
// APPLICATION ROUTER
// =====================================================

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* =============================================
            ECOSYSTEM ENTRY
            ============================================= */}

        <Route
          path="/"
          element={<EcosystemEntry />}
        />

        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/student/profile" element={<StudentProfile />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />

        {/* =============================================
            ADMIN PORTAL
            ============================================= */}

        <Route
          path="/admin"
          element={<AdminPortal />}
        />

        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />

        {/* =============================================
            ADMIN APPLICATION
            ============================================= */}

        <Route
          path="/admin/apply"
          element={<AdminApply />}
        />

        <Route
          path="/admin/applications"
          element={<AdminApply />}
        />

        {/* =============================================
            ADMIN REGISTRATION
            ============================================= */}

        <Route
          path="/admin/register"
          element={<AdminRegister />}
        />

        {/* =============================================
            ADMIN DASHBOARD
            ============================================= */}

        <Route
          path="/admin/dashboard"
          element={<AdminDashboard />}
        />

        <Route path="/admin/curriculum" element={<AdminWorkspacePage />} />
        <Route path="/admin/requests" element={<AdminWorkspacePage />} />
        <Route path="/admin/notifications" element={<AdminWorkspacePage />} />
        <Route path="/admin/activity" element={<AdminWorkspacePage />} />
        <Route path="/admin/feedback" element={<AdminWorkspacePage />} />
        <Route path="/student/syllabus-feedback" element={<StudentSyllabusFeedbackPage />} />
        <Route path="/admin/department" element={<AdminWorkspacePage />} />
        <Route path="/admin/profile" element={<AdminWorkspacePage />} />
        <Route path="/admin/settings" element={<AdminSettings />} />

        <Route
          path="/admin/change-password"
          element={<AdminChangePassword />}
        />

        {/* =============================================
            SUPER ADMIN LOGIN
            ============================================= */}

        <Route
          path="/super-admin/login"
          element={<SuperAdminLogin />}
        />

        {/* =============================================
            SUPER ADMIN PORTAL
            ============================================= */}

        <Route
          path="/super-admin"
          element={<RequireSuperAdmin><SuperAdminLayout /></RequireSuperAdmin>}
        >
          <Route
            index
            element={<SuperAdminDashboard />}
          />

          <Route
            path="users"
            element={<SuperAdminUsers />}
          />

          <Route
            path="admins"
            element={<SuperAdminAdmins />}
          />

          <Route
            path="users/:userId"
            element={<SuperAdminUserDetails />}
          />

          <Route
            path="applications"
            element={<SuperAdminApplications />}
          />

          <Route
            path="audit"
            element={<SuperAdminAudit />}
          />

          <Route
            path="feedback"
            element={<SuperAdminFeedback />}
          />

          <Route
            path="institutions"
            element={<SuperAdminInstitutions />}
          />

          <Route
            path="institutions/create"
            element={<SuperAdminInstitutionCreate />}
          />

          <Route
            path="curriculum"
            element={<SuperAdminCurriculum />}
          />

          <Route
            path="settings"
            element={<SuperAdminSettings />}
          />

          <Route
            path="password-requests"
            element={<SuperAdminPasswordRequests />}
          />

          <Route
            path="security-alerts"
            element={<SuperAdminSecurityAlerts />}
          />

          <Route
            path="admin-announcements"
            element={<SuperAdminAdminMessages />}
          />

          <Route
            path="admin-requests"
            element={<SuperAdminAdminRequests />}
          />
        </Route>

        {/* =============================================
            UNKNOWN ROUTES
            ============================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
