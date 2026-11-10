import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import StudentPlatform from "../features/dashboard/StudentPlatform";
import AcademicSetupPage from "../features/dashboard/AcademicSetupPage";
import { useAuth } from "../features/auth/AuthContext";
import StudentNotificationsPage from "../features/student/StudentNotificationsPage";
import StudentSyllabusFeedbackPage from "../features/student/StudentSyllabusFeedbackPage";
import "../features/student/student-services.css";

function HomePage() {
  const { user, isGuest, loading } = useAuth();
  if (loading) return <LoginPage />;
  if (user || isGuest) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

function NotFoundPage() {
  return <main className="not-found"><h1>404</h1><p>We couldn't find that Gradly page.</p><a href="/">Return home</a></main>;
}

function SignedInStudentRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="route-loading" role="status">Preparing your Gradly workspace…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function AppRoutes() {
  const navigate = useNavigate();
  useEffect(() => {
    const onPageShow = () => { if (window.location.pathname === "/login") navigate("/", { replace: true }); };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [navigate]);
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<Navigate to="/" replace />} />
    <Route path="/academic-setup" element={<ProtectedRoute><AcademicSetupPage /></ProtectedRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><StudentPlatform /></ProtectedRoute>} />
    <Route path="/notifications" element={<SignedInStudentRoute><StudentNotificationsPage /></SignedInStudentRoute>} />
    <Route path="/syllabus-feedback" element={<SignedInStudentRoute><StudentSyllabusFeedbackPage /></SignedInStudentRoute>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
