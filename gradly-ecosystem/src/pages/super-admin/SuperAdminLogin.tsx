import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  API_BASE_URL,
  setToken,
  verifySession,
} from "../../lib/superAdminSession";

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f5f3ff",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 10px 30px rgba(109, 40, 217, 0.15)",
    display: "grid",
    gap: 14,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #c4b5fd",
    fontSize: 15,
  },
  button: {
    padding: "11px 12px",
    borderRadius: 8,
    border: "none",
    background: "#6d28d9",
    color: "#fff",
    fontSize: 15,
    cursor: "pointer",
  },
  error: { color: "#b91c1c", fontSize: 14, margin: 0 },
} as const;

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from ?? "/super-admin";

  const [checking, setChecking] = useState(true);
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    verifySession().then((status) => {
      if (cancelled) return;
      if (status === "valid") navigate(from, { replace: true });
      else setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, from]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/super-admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: adminCode.trim(), password }),
      });

      const result = await response.json().catch(() => null);
      const token: unknown = result?.token ?? result?.accessToken;

      if (!response.ok || typeof token !== "string") {
        setError(
          response.status === 429
            ? "Too many attempts. Please wait and try again."
            : result?.message ?? "Login failed."
        );
        return;
      }

      setToken(token);
      setPassword("");
      navigate(from, { replace: true });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <p style={{ padding: 24 }}>Checking session…</p>;
  }

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h1 style={{ margin: 0, color: "#4c1d95" }}>Super Admin sign in</h1>

        <input
          style={styles.input}
          type="text"
          placeholder="Admin code"
          autoComplete="username"
          value={adminCode}
          onChange={(e) => setAdminCode(e.target.value)}
          required
        />

        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

