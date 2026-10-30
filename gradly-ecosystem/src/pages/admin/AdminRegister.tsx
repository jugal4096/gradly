import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../config/firebase";
import "./AdminRegister.css";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";

export default function AdminRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const applicationId = searchParams.get("applicationId");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registeredAdminId, setRegisteredAdminId] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoading(false);

      if (!user) {
        navigate("/admin/apply", { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate]);

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const normalizedAdminId = adminId.trim();

    if (!applicationId) {
      setError(
        "Application ID is missing. Return to your application dashboard and continue registration again."
      );
      return;
    }

    if (!/^[A-Za-z0-9_-]{4,32}$/.test(normalizedAdminId)) {
      setError(
        "Admin ID must be 4–32 characters and contain only letters, numbers, underscores or hyphens."
      );
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setError("Password must contain between 12 and 128 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setError("Your session has expired. Please sign in again.");
      navigate("/admin/apply");
      return;
    }

    if (!isApiConfigured) {
      setError(API_CONFIGURATION_ERROR);
      return;
    }

    setSubmitting(true);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(
        `${API_BASE_URL}/api/admin-registration/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            application_id: applicationId,
            admin_id: normalizedAdminId,
            password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to complete registration."
        );
      }

      const savedAdminId =
        result.admin?.admin_code || normalizedAdminId;

      setRegisteredAdminId(savedAdminId);
      setSuccess("Your administrator account has been created successfully.");

      setPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-register-page">
        <div className="register-card">
          <p className="register-muted">Checking your session...</p>
        </div>
      </main>
    );
  }

  if (success && registeredAdminId) {
    return (
      <main className="admin-register-page">
        <section className="register-card register-success">
          <div className="register-icon">✓</div>

          <p className="register-eyebrow">GRADLY ECOSYSTEM</p>

          <h1>You're all set!</h1>

          <p className="register-muted">
            Your administrator account has been created successfully.
          </p>

          <div className="registered-id-box">
            <span>Your Admin ID</span>
            <strong>{registeredAdminId}</strong>
          </div>

          <p className="register-hint">
            Keep your Admin ID safe. You will use it to sign in to the Admin
            Portal.
          </p>

          <button
            className="register-primary-button"
            onClick={() => navigate("/admin/login")}
          >
            Continue to Admin Login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-register-page">
      <section className="register-card">
        <div className="register-brand">
          <div className="register-brand-mark">G</div>

          <div>
            <strong>Gradly</strong>
            <span>Ecosystem</span>
          </div>
        </div>

        <p className="register-eyebrow">ADMINISTRATOR ONBOARDING</p>

        <h1>Create your admin account</h1>

        <p className="register-muted">
          Choose your Admin ID and password to complete your registration.
        </p>

        {error && (
          <div className="register-alert register-alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleRegistration}>
          <label htmlFor="admin-id">Preferred Admin ID</label>

          <input
            id="admin-id"
            type="text"
            value={adminId}
            onChange={(event) => setAdminId(event.target.value)}
            placeholder="e.g. GECA_CIVIL_01"
            minLength={4}
            maxLength={32}
            autoComplete="username"
            required
          />

          <p className="register-field-hint">
            Use 4–32 letters, numbers, underscores or hyphens.
          </p>

          <label htmlFor="admin-password">Password</label>

          <div className="register-password-wrapper">
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a strong password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />

            <button
              className="register-show-password"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label htmlFor="confirm-password">Confirm Password</label>

          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Enter your password again"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />

          <div className="register-security-note">
            <span>🔒</span>
            <p>
              Your password is securely hashed before being stored. Never share
              it with anyone.
            </p>
          </div>

          <button
            type="submit"
            className="register-primary-button"
            disabled={submitting}
          >
            {submitting ? "Creating account..." : "Complete Registration"}
          </button>
        </form>

        <button
          className="register-back-button"
          type="button"
          onClick={() => navigate("/admin/apply")}
        >
          ← Back to application dashboard
        </button>
      </section>
    </main>
  );
}