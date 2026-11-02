import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import EcosystemEntry from "../pages/entry/EcosystemEntry";
import AdminLogin from "../pages/admin/AdminLogin";
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
        <Route path="/" element={<EcosystemEntry />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/super-admin/login" element={<SuperAdminLogin />} />
        <Route path="/super-admin" element={<SuperAdminLayout />}>
          <Route index element={<SuperAdminDashboard />} />
          <Route path="users" element={<SuperAdminUsers />} />
          <Route path="users/:userId" element={<SuperAdminUserDetails />} />
          <Route path="applications" element={<SuperAdminApplications />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
