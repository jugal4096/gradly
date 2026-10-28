import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import EcosystemEntry from "../pages/entry/EcosystemEntry";

import AdminLogin from "../pages/admin/AdminLogin";
import AdminDashboard from "../pages/admin/AdminDashboard";

import SuperAdminLogin from "../pages/super-admin/SuperAdminLogin";
import SuperAdminLayout from "../layouts/SuperAdminLayout";

import SuperAdminDashboard from "../pages/super-admin/SuperAdminDashboard";
import SuperAdminUsers from "../pages/super-admin/SuperAdminUsers";
import SuperAdminUserDetails from "../pages/super-admin/SuperAdminUserDetails";
import SuperAdminApplications from "../pages/super-admin/SuperAdminApplications";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =====================================================
            ECOSYSTEM ENTRY
            ===================================================== */}

        <Route
          path="/"
          element={<EcosystemEntry />}
        />


        {/* =====================================================
            ADMIN LOGIN
            ===================================================== */}

        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />

        <Route
          path="/admin/dashboard"
          element={<AdminDashboard />}
        />


        {/* =====================================================
            SUPER ADMIN LOGIN
            ===================================================== */}

        <Route
          path="/super-admin/login"
          element={<SuperAdminLogin />}
        />


        {/* =====================================================
            SUPER ADMIN PORTAL
            ===================================================== */}

        <Route
          path="/super-admin"
          element={<SuperAdminLayout />}
        >

          {/* Dashboard */}
          <Route
            index
            element={<SuperAdminDashboard />}
          />

          {/* Users */}
          <Route
            path="users"
            element={<SuperAdminUsers />}
          />

          {/* Individual User */}
          <Route
            path="users/:userId"
            element={<SuperAdminUserDetails />}
          />

          {/* Admin Applications */}
          <Route
            path="applications"
            element={<SuperAdminApplications />}
          />

        </Route>


        {/* =====================================================
            UNKNOWN ROUTES
            ===================================================== */}

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