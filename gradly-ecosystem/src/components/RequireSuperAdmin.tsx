import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { verifySession, type SessionStatus } from "../lib/superAdminSession";

type GuardState = "checking" | SessionStatus;

export default function RequireSuperAdmin({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();
  const [state, setState] = useState<GuardState>("checking");
  const [attempt, setAttempt] = useState(0);

  // Session verification is an asynchronous external-system check; its result updates guard state.
  useEffect(() => {
    let cancelled = false;

    verifySession().then((status) => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!cancelled) setState(status);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state === "checking") {
    return <p style={{ padding: 24 }}>Verifying session…</p>;
  }

  if (state === "invalid") {
    return (
      <Navigate
        to="/super-admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (state === "unreachable") {
    return (
      <div style={{ padding: 24 }}>
        <p>Could not reach the server to verify your session.</p>
        <button type="button" onClick={() => { setState("checking"); setAttempt((n) => n + 1); }}>
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
