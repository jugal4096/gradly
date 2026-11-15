import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "../../student-entry.css";

function GoogleMark() {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="google-mark">
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.89c-.58 2.96-2.27 5.47-4.78 7.16l7.73 6C44.35 38.01 46.98 31.91 46.98 24.55Z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.82l-7.73-6c-2.14 1.44-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.94 23.94 0 0 0 0 21.56l7.98-6.19Z"/>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
  </svg>;
}
function GradlyMark() {
  return <svg className="gradly-mark" viewBox="0 0 40 40" role="img" aria-label="Gradly">
    <path d="M32.1 12.2A15.5 15.5 0 1 0 35.4 22H20.2v-5.3h20v7.1A20.2 20.2 0 1 1 35.4 9.8"/>
    <circle cx="29.5" cy="29.5" r="3.1"/>
  </svg>;
}
const headlines = [
  "Make your academic journey count.",
  "Every semester is a new opportunity.",
  "Dream bigger. Track your progress. Keep moving forward.",
];
export default function LoginPage() {
  const { loginWithGoogle, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setHeadlineIndex((current) => (current + 1) % headlines.length), 3900);
    return () => window.clearInterval(interval);
  }, []);
  async function handleGoogleLogin() {
    try {
      setError("");
      setLoggingIn(true);
      await loginWithGoogle();
      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      console.error(loginError);
      const message = loginError instanceof Error ? loginError.message : "";
      setError(message.includes("was deleted")
        ? "This account was deleted and cannot be used to sign in. You can continue as a guest or contact Gradly support if this was a mistake."
        : message || "Sign-in could not be completed. Please try again.");
    } finally { setLoggingIn(false); }
  }
  function handleGuest() {
    continueAsGuest();
    navigate("/dashboard", { replace: true });
  }
  return <main className="welcome-page">
    <div className="hero-visual" aria-hidden="true"><img src="/gradly-orbit.svg" alt="" /></div>
    <div className="hero-vignette" aria-hidden="true"/>
    <header className="welcome-brand">
      <Link to="/" aria-label="Gradly home"><GradlyMark/><span className="brand-wordmark">gradly<span>.</span></span></Link>
    </header>
    <section className="hero-copy" aria-label="Welcome to Gradly">
      <p className="story-intro">A NEW WAY FORWARD</p>
      <div className="story-headline-frame" aria-live="polite">
        <h1 key={headlineIndex} className="story-headline">{headlines[headlineIndex]}</h1>
      </div>
      <p className="hero-description">One place to understand your academics, follow your progress, and plan what comes next. Make every semester count with Gradly.</p>
      <div className="auth-actions">
        <button className="google-signin" type="button" onClick={handleGoogleLogin} disabled={loggingIn}>
          <GoogleMark/><span>{loggingIn ? "Connecting…" : "Continue with Google"}</span>
        </button>
        <button className="guest-signin" type="button" onClick={handleGuest}>Continue as Guest <span aria-hidden="true">→</span></button>
      </div>
      {error && <p className="welcome-error" role="alert">{error}</p>}
      <p className="welcome-legal">By continuing, you agree to our <Link to="/terms">Terms of Service</Link> and acknowledge our <Link to="/privacy">Privacy Policy</Link>.</p>
    </section>
    <section className="hero-features" aria-label="Gradly features">
      <div><strong>SGPA &amp; CGPA</strong><span>Understand your performance</span></div>
      <div><strong>Academic progress</strong><span>Track every semester</span></div>
      <div><strong>Smarter planning</strong><span>Know what comes next</span></div>
    </section>
    <div className="hero-bottom-curve" aria-hidden="true"/>
  </main>;
}
