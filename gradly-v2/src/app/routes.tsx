import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import LoginPage from "../features/auth/LoginPage";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import DashboardPage from "../features/dashboard/DashboardPage";
import { useAuth } from "../features/auth/AuthContext";

function HomePage() {
  const { user, isGuest, loading } = useAuth();
  // Keep a real fallback beneath the splash while Firebase restores its session.
  if (loading) return <LoginPage />;
  if (user || isGuest) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

function LaunchSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => setVisible(false), reducedMotion ? 500 : 3000);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div className="launch-splash" role="status" aria-label="Gradly is loading">
      <img
        src="/gradly-intro.gif"
        alt="Gradly animated logo"
        onError={(event) => {
          event.currentTarget.style.display = "none";
          const fallback = event.currentTarget.nextElementSibling;
          if (fallback instanceof HTMLElement) fallback.hidden = false;
        }}
      />
      <span className="launch-splash-fallback" hidden>Gradly<span>✦</span></span>
      <span className="sr-only">Loading Gradly</span>
    </div>
  );
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
      <LaunchSplash />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
