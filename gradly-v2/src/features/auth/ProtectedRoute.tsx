import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isGuest, loading } = useAuth();

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loading-mark">G</div>
        <p>Preparing your Gradly workspace…</p>
      </main>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}