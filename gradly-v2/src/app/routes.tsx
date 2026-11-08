import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import LoginPage from "../features/auth/LoginPage";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import StudentPlatform from "../features/dashboard/StudentPlatform";\nimport AcademicSetupPage from "../features/dashboard/AcademicSetupPage";
import { useAuth } from "../features/auth/AuthContext";

function HomePage() {
  const { user, isGuest, loading } = useAuth();
  // Keep a real fallback beneath the splash while Firebase restores its session.
  if (loading) return <LoginPage />;
  if (user || isGuest) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}


function NotFoundPage() {
  return (
    <main className="not-found">
      <h1>404</h1>
      <p>We couldn't find that Gradly page.</p>
      <a href="/">Return home</a>
    </main>
  );
}

export default function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    const onPageShow = () => {
      if (window.location.pathname === "/login") navigate("/", { replace: true });
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <StudentPlatform />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
