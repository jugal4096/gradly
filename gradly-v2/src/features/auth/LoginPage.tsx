import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const { loginWithGoogle, enterGuestMode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleGoogleLogin() {
    try {
      setError("");
      setLoggingIn(true);
      await loginWithGoogle();
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Google login failed.");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleGuestEntry() {
    enterGuestMode();
    navigate("/dashboard", { replace: true });
  }

  return (
    <main className="login-page">
      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />
      <header className="login-topbar">
        <a className="brand-lockup" href="/" aria-label="Gradly home">
          <span className="brand-symbol">G</span>
          <span><strong>gradly</strong><small>ACADEMIC INTELLIGENCE</small></span>
        </a>
        <span className="secure-label"><span className="status-dot" /> YOUR ACADEMIC SPACE</span>
      </header>

      <section className="login-content">
        <div className="login-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> MADE FOR YOUR NEXT CHAPTER</span>
          <h1>Your academic life,<br /><span>in one clear view.</span></h1>
          <p>Track your progress, plan your grades, and make your next semester count — without the spreadsheet chaos.</p>
          <div className="login-proof-row">
            <div className="proof-item"><span className="proof-icon">↗</span><span><strong>Know your progress</strong><small>Grades and CGPA at a glance</small></span></div>
            <div className="proof-item"><span className="proof-icon">✳</span><span><strong>Plan with purpose</strong><small>Make every credit count</small></span></div>
          </div>
        </div>

        <section className="login-card" aria-labelledby="login-heading">
          <div className="card-orbit" aria-hidden="true">✳</div>
          <span className="card-kicker">WELCOME TO GRADLY</span>
          <h2 id="login-heading">Let's get you started.</h2>
          <p className="login-card-description">Sign in to keep your academic profile synced across sessions.</p>
          <button className="google-button" type="button" onClick={handleGoogleLogin} disabled={loggingIn}>
            <span className="google-g" aria-hidden="true">G</span>
            {loggingIn ? "Connecting securely…" : "Continue with Google"}
            <span className="button-arrow">↗</span>
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="login-divider"><span /> OR <span /></div>
          <button className="guest-button" type="button" onClick={handleGuestEntry}>
            Explore as a guest <span>→</span>
          </button>
          <p className="privacy-note"><span>◈</span> Guest changes stay in this browser session. Sign in to connect your account.</p>
        </section>
      </section>

      <footer className="login-footer">
        <span>© {new Date().getFullYear()} Gradly</span>
        <span>Built for students, by ambition.</span>
        <span className="footer-live"><span className="status-dot" /> YOUR JOURNEY STARTS HERE</span>
      </footer>
    </main>
  );
}