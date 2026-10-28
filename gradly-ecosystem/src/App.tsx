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

// =====================================================
// SUPER ADMIN
// =====================================================

import SuperAdminLogin from "./pages/super-admin/SuperAdminLogin";
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import RequireSuperAdmin from "./components/RequireSuperAdmin";

import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import SuperAdminUsers from "./pages/super-admin/SuperAdminUsers";
import SuperAdminAdminEdit from "./pages/super-admin/SuperAdminAdminEdit";
import SuperAdminUserDetails from "./pages/super-admin/SuperAdminUserDetails";
import SuperAdminUserActivity from "./pages/super-admin/SuperAdminUserActivity";
import SuperAdminApplications from "./pages/super-admin/SuperAdminApplications";
import SuperAdminControlCenter from "./pages/super-admin/SuperAdminControlCenter";

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
            path="users/:userId/activity"
            element={<SuperAdminUserActivity />}
          />

          <Route
            path="users/:userId"
            element={<SuperAdminUserDetails />}
          />

          <Route
            path="applications"
            element={<SuperAdminApplications />}
          />

          <Route path="admins" element={<SuperAdminControlCenter />} />
          <Route path="admins/:adminId/edit" element={<SuperAdminAdminEdit />} />
          <Route path="institutions" element={<SuperAdminControlCenter />} />\n          <Route path="institution-requests" element={<SuperAdminControlCenter />} />
          <Route path="courses" element={<SuperAdminControlCenter />} />
          <Route path="curriculum" element={<SuperAdminControlCenter />} />
          <Route path="feedback" element={<SuperAdminControlCenter />} />\n          <Route path="student-feedback" element={<SuperAdminControlCenter />} />
          <Route path="audit" element={<SuperAdminControlCenter />} />
          <Route path="audit-logs" element={<SuperAdminControlCenter />} />
          <Route path="settings" element={<SuperAdminControlCenter />} />\n          <Route path="security-notifications" element={<SuperAdminControlCenter />} />\n          <Route path="guest-sessions" element={<SuperAdminControlCenter />} />
          <Route path="admin-requests" element={<SuperAdminControlCenter />} />
          <Route path="password-requests" element={<SuperAdminControlCenter />} />
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
