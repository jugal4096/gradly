import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "../../student-entry.css";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="google-mark">
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.89c-.58 2.96-2.27 5.47-4.78 7.16l7.73 6C44.35 38.01 46.98 31.91 46.98 24.55Z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.82l-7.73-6c-2.14 1.44-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/>
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.94 23.94 0 0 0 0 21.56l7.98-6.19Z"/>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
    </svg>
  );
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
    const interval = window.setInterval(() => {
      setHeadlineIndex((current) => (current + 1) % headlines.length);
    }, 3900);
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
    } finally {
      setLoggingIn(false);
    }
  }

  function handleGuest() {
    continueAsGuest();
    navigate("/dashboard", { replace: true });
  }

  return (
    <main className="welcome-page">
      <section className="welcome-story" aria-label="Welcome to Gradly">
        <div className="welcome-texture" aria-hidden="true" />
        <header className="welcome-brand">
          <Link to="/" aria-label="Gradly home">gradly<span>.</span></Link>
        </header>
        <div className="story-content">
          <p className="story-intro">A NEW WAY FORWARD</p>
          <div className="story-headline-frame">
            <h1 key={headlineIndex} className="story-headline">{headlines[headlineIndex]}</h1>
          </div>
          <div className="journey-art" aria-hidden="true">
            <div className="journey-line"><span /><span /><span /><span /></div>
            <div className="journey-caption">YOUR JOURNEY, ONE STEP AT A TIME</div>
          </div>
        </div>
        <div className="story-bottom-mark" aria-hidden="true"><span /> LEARN <i /> TRACK <i /> GROW</div>
      </section>

      <section className="welcome-auth" aria-label="Sign in or continue as guest">
        <div className="auth-inner">
          <div className="auth-brand-mobile"><Link to="/">gradly<span>.</span></Link></div>
          <div className="auth-heading">
            <h2>Welcome to Gradly</h2>
            <p>Your journey starts here.</p>
          </div>
          <div className="auth-actions">
            <button className="google-signin" type="button" onClick={handleGoogleLogin} disabled={loggingIn}>
              <GoogleMark />
              <span>{loggingIn ? "Connecting…" : "Continue with Google"}</span>
            </button>
            <button className="guest-signin" type="button" onClick={handleGuest}>
              Continue as Guest
              <span aria-hidden="true">→</span>
            </button>
          </div>
          {error && <p className="welcome-error" role="alert">{error}</p>}
          <p className="welcome-legal">
            By continuing, you agree to our <Link to="/terms">Terms of Service</Link> and acknowledge our <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </div>
        <div className="auth-bottom">© {new Date().getFullYear()} Gradly</div>
      </section>
    </main>
  );
}
