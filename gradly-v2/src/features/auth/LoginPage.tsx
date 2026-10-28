import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./LoginPage.css";

const LOGO_URL = "https://raw.githubusercontent.com/jugal4096/gradly/fix/gradly-audit-2026-10-17/gradly-ecosystem/public/gradly-ecosystem-logo.png";

export default function LoginPage() {
  const { loginWithGoogle, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [authLoading, user, navigate]);

  async function handleGoogleLogin() {
    try {
      setError("");
      setLoggingIn(true);
      await loginWithGoogle();
      navigate("/dashboard", { replace: true });
    } catch (cause) {
      console.error(cause);
      setError(cause instanceof Error ? cause.message : "Google login failed. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <main className="gradly-landing gradly-landing--minimal">
      <div className="login-backdrop" aria-hidden="true">
        <div className="login-backdrop__slide login-backdrop__slide--one" />
        <div className="login-backdrop__slide login-backdrop__slide--two" />
        <div className="login-backdrop__slide login-backdrop__slide--three" />
        <div className="login-backdrop__slide login-backdrop__slide--four" />
        <div className="login-backdrop__shade" />
      </div>
      <div className="landing-noise" aria-hidden="true" />
      <header className="landing-nav landing-nav--minimal">
        <a className="landing-brand" href="#home" aria-label="Gradly home">
          <img src={LOGO_URL} alt="Gradly" />
          <span className="landing-brand__fallback" aria-hidden="true">gradly<span>.</span></span>
        </a>
        <span className="landing-nav__tag">YOUR ACADEMIC SPACE</span>
      </header>

      <section className="landing-hero landing-hero--minimal" id="home" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="landing-eyebrow"><span className="eyebrow-pulse" /> YOUR ACADEMIC JOURNEY, SIMPLIFIED</p>
          <h1 id="hero-title">Your academics.<br /><span>All in one place.</span></h1>
          <p className="hero-description">Know where you stand, plan where you’re going, and make every semester count.</p>

          <div className="landing-feature-pills" aria-label="Gradly highlights">
            <div className="landing-feature-pill"><span className="landing-feature-pill__icon">↗</span><span><strong>SGPA & CGPA</strong><small>Quick, clear calculations</small></span></div>
            <div className="landing-feature-pill"><span className="landing-feature-pill__icon">◎</span><span><strong>Academic insights</strong><small>Your progress, simplified</small></span></div>
            <div className="landing-feature-pill"><span className="landing-feature-pill__icon">✦</span><span><strong>Made for students</strong><small>One space for your goals</small></span></div>
          </div>

          <p className="auth-prompt">A better view of your academic journey starts here.</p>
          <div className="hero-actions hero-actions--minimal">
            <button className="button-primary google-button" onClick={handleGoogleLogin} disabled={loggingIn}>
              <svg className="google-mark" viewBox="0 0 48 48" role="img" aria-label="Google logo">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.65 5.93c4.46-4.12 7.13-10.2 7.13-17.58Z"/>
                <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.87l-7.65-5.93c-2.13 1.43-4.85 2.28-8.25 2.28-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 43.62 14.62 48 24 48Z"/>
              </svg>
              <span>{loggingIn ? "Signing in…" : "Continue with Google"}</span>
            </button>
            <button className="button-quiet" onClick={() => { setError(""); navigate("/guest/setup"); }} disabled={loggingIn}>
              Continue as Guest <span aria-hidden="true">→</span>
            </button>
          </div>
          {error && <p className="landing-error" role="alert">{error}</p>}
          <p className="landing-login-note"><span aria-hidden="true">✦</span> Start exploring with a guest workspace, or sign in to unlock your full academic toolkit.</p>
        </div>
      </section>
      <footer className="landing-footer landing-footer--minimal">
        <a className="landing-footer__brand" href="#home">gradly<span>.</span></a>
        <span>MADE FOR YOUR JOURNEY.</span>
      </footer>
    </main>
  );
}
