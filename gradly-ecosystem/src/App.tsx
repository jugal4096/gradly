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
import AdminRequestCenter from "./pages/admin/AdminRequestCenter";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminChangePassword from "./pages/admin/AdminChangePassword";

// =====================================================
// SUPER ADMIN
// =====================================================

import SuperAdminLogin from "./pages/super-admin/SuperAdminLogin";
import AdminWorkspaceLayout from "./layouts/AdminWorkspaceLayout";
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

        {/* Authenticated Admin workspace: one shared shell for every section. */}
        <Route path="/admin" element={<AdminWorkspaceLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="curriculum" element={<AdminWorkspacePage />} />
          <Route path="requests" element={<AdminRequestCenter />} />
          <Route path="notifications" element={<AdminWorkspacePage />} />
          <Route path="activity" element={<AdminWorkspacePage />} />
          <Route path="feedback" element={<AdminWorkspacePage />} />
          <Route path="department" element={<AdminWorkspacePage />} />
          <Route path="profile" element={<AdminWorkspacePage />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="change-password" element={<AdminChangePassword />} />
        </Route>

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
