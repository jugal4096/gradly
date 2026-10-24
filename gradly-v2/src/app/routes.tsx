import { Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "../features/auth/LoginPage";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import DashboardPage from "../features/dashboard/DashboardPage";
import GuestDashboardPage from "../features/guest/GuestDashboardPage";
import { useAuth } from "../features/auth/AuthContext";

function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <main className="app-loading">Loading Gradly…</main>;
  if (user) return <Navigate to="/dashboard" replace />;
  if (sessionStorage.getItem("gradly_guest_session_token")) return <Navigate to="/guest" replace />;
  return <LoginPage />;
}

function NotFoundPage() {
  return (
    <main className="app-not-found">
      <h1>404</h1>
      <p>Page not found.</p>
      <a href="/">Back to Gradly</a>
    </main>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/guest" element={<GuestDashboardPage />} />
      <Route
        path="/dashboard"
        element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
