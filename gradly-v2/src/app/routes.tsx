import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import StudentPlatform from "../features/dashboard/StudentPlatform";
import AcademicSetupPage from "../features/dashboard/AcademicSetupPage";
import ExamProfileSetupPage from "../features/dashboard/ExamProfileSetupPage";
import TesterAcademicSetupPage from "../features/dashboard/TesterAcademicSetupPage";
import { useAuth } from "../features/auth/AuthContext";

function HomePage() {
  const { user, isGuest, isTester, loading } = useAuth();
  if (loading) return <LoginPage />;
  if (isTester) return <Navigate to="/dashboard" replace />;
  if (user || isGuest) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

function TesterWorkspaceBridge() {
  const { user, isTester, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    navigate(isTester && user ? "/dashboard" : "/", { replace: true });
  }, [loading, isTester, user, navigate]);
  return <main className="tester-setup-loading">Opening your isolated Gradly student workspace…</main>;
}

function NotFoundPage() {
  return <main className="not-found"><h1>404</h1><p>We couldn't find that Gradly page.</p><a href="/">Return home</a></main>;
}

export default function AppRoutes() {
  const navigate = useNavigate();
  const { isTester } = useAuth();
  useEffect(() => {
    const onPageShow = () => { if (window.location.pathname === "/login") navigate("/", { replace: true }); };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [navigate]);
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<Navigate to="/" replace />} />
    <Route path="/tester-workspace" element={<TesterWorkspaceBridge />} />
    <Route path="/academic-setup" element={<ProtectedRoute>{isTester ? <TesterAcademicSetupPage /> : <AcademicSetupPage />}</ProtectedRoute>} />
    <Route path="/exam-profile" element={<ProtectedRoute>{isTester ? <Navigate to="/dashboard" replace /> : <ExamProfileSetupPage />}</ProtectedRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><StudentPlatform /></ProtectedRoute>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
