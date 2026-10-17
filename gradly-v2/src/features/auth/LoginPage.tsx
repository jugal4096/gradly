import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();

  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleGoogleLogin() {
    try {
      setError("");
      setLoggingIn(true);

      await loginWithGoogle();
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Google login failed."
      );
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div>
      <h1>Gradly</h1>

      <p>Academic Intelligence & Planning Platform</p>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loggingIn}
      >
        {loggingIn
          ? "Signing in..."
          : "Continue with Google"}
      </button>

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}
    </div>
  );
}