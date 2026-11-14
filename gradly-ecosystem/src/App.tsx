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
import TesterLogin from "./pages/tester/TesterLogin";
import TesterWorkspace from "./pages/tester/TesterWorkspace";

// =====================================================
// ADMIN
// =====================================================

import AdminRegister from "./pages/admin/AdminRegister";
import AdminPortal from "./pages/admin/AdminPortal";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminApply from "./pages/admin/AdminApply";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminWorkspacePage from "./pages/admin/AdminWorkspacePage";
import AdminRequestCenter from "./pages/admin/AdminRequestCenter";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminChangePassword from "./pages/admin/AdminChangePassword";
import StudentSyllabusFeedbackPage from "./pages/student/StudentSyllabusFeedbackPage";
import StudentNotificationsPage from "./pages/student/StudentNotificationsPage";

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
import SuperAdminAdminProfile from "./pages/super-admin/SuperAdminAdminProfile";
import SuperAdminAdminActions from "./pages/super-admin/SuperAdminAdminActions";
import SuperAdminFeedback from "./pages/super-admin/SuperAdminFeedback";
import SuperAdminCurriculum from "./pages/super-admin/SuperAdminCurriculum";
import SuperAdminSettings from "./pages/super-admin/SuperAdminSettings";
import SuperAdminPasswordRequests from "./pages/super-admin/SuperAdminPasswordRequests";
import SuperAdminSecurityAlerts from "./pages/super-admin/SuperAdminSecurityAlerts";
import SuperAdminAdminMessages from "./pages/super-admin/SuperAdminAdminMessages";
import SuperAdminRequestCenter from "./pages/super-admin/SuperAdminRequestCenter";
import SuperAdminTesterManagement from "./pages/super-admin/SuperAdminTesterManagement";

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
        <Route path="/admin/requests" element={<AdminRequestCenter />} />
        <Route path="/admin/notifications" element={<AdminWorkspacePage />} />
        <Route path="/admin/activity" element={<AdminWorkspacePage />} />
        <Route path="/admin/feedback" element={<AdminWorkspacePage />} />
        <Route path="/student/syllabus-feedback" element={<StudentSyllabusFeedbackPage />} />
        <Route path="/student/notifications" element={<StudentNotificationsPage />} />
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
            path="dashboard"
            element={<SuperAdminDashboard />}
          />

          <Route
            path="users"
            element={<SuperAdminUsers />}
          />

          <Route path="testers" element={<SuperAdminTesterManagement />} />

          {/* Preserve old bookmarks while keeping blacklist management inside Settings. */}
          <Route
            path="blacklist"
            element={<Navigate to="/super-admin/settings#account-restrictions" replace />}
          />

          <Route
            path="admins"
            element={<SuperAdminAdmins />}
          />

          <Route path="admins/:adminId/profile" element={<SuperAdminAdminProfile />} />
          <Route path="admins/:adminId/activity" element={<SuperAdminAudit />} />
          <Route path="admins/:adminId/actions" element={<SuperAdminAdminActions />} />

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
            path="curriculum"
            element={<SuperAdminCurriculum />}
          />

          <Route
            path="settings"
            element={<SuperAdminSettings />}
          />

          <Route
            path="requests"
            element={<SuperAdminRequestCenter />}
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
            element={<Navigate to="/super-admin/requests" replace />}
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
