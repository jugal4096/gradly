import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "./AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isGuest, loading } = useAuth();

  if (loading) {
    return <div className="route-loading" role="status">Preparing your Gradly workspace…</div>;
  }

  if (!user && !isGuest) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
