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
import SuperAdminUserDetails from "./pages/super-admin/SuperAdminUserDetails";
import SuperAdminApplications from "./pages/super-admin/SuperAdminApplications";
import SuperAdminAdministrators from "./pages/super-admin/SuperAdminAdministrators";
import SuperAdminModule from "./pages/super-admin/SuperAdminModule";

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
            path="users/:userId"
            element={<SuperAdminUserDetails />}
          />

          <Route
            path="applications"
            element={<SuperAdminApplications />}
          />

          <Route
            path="admins"
            element={<SuperAdminAdministrators />}
          />

          <Route path="institutions" element={<SuperAdminModule />} />
          <Route path="curriculum" element={<SuperAdminModule />} />
          <Route path="audit" element={<SuperAdminModule />} />
          <Route path="audit-logs" element={<Navigate to="/super-admin/audit" replace />} />
          <Route path="feedback" element={<SuperAdminModule />} />
          <Route path="settings" element={<SuperAdminModule />} />
          <Route path="safety" element={<SuperAdminModule />} />
          <Route path="announcements" element={<SuperAdminModule />} />
          <Route path="password-resets" element={<SuperAdminModule />} />
          <Route path="requests" element={<SuperAdminModule />} />
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
