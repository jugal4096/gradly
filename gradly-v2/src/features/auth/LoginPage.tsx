import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useTester } from "../tester/TesterContext";
import "../../student-entry.css";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="google-mark">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.89c-.58 2.96-2.27 5.47-4.78 7.16l7.73 6C44.35 38.01 46.98 31.91 46.98 24.55Z"/>
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.94 23.94 0 0 0 0 21.56l7.98-6.19Z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.82l-7.73-6c-2.14 1.44-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/>
    </svg>
  );
}

export default function LoginPage() {
  const { loginWithGoogle, continueAsGuest } = useAuth();
  const { enterTester } = useTester();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleUserLogin() {
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

  function handleTester() {
    enterTester();
    navigate("/tester", { replace: true });
  }

  return (
    <main className="entry-page">
      <div className="entry-grid" aria-hidden="true" />
      <div className="entry-glow entry-glow-a" aria-hidden="true" />
      <div className="entry-glow entry-glow-b" aria-hidden="true" />
      <div className="entry-glow entry-glow-c" aria-hidden="true" />
      <div className="entry-orbit entry-orbit-a" aria-hidden="true" />
      <div className="entry-orbit entry-orbit-b" aria-hidden="true" />
      <div className="entry-prism" aria-hidden="true"><span>G</span></div>

      <header className="entry-nav">
        <a className="brand-lockup" href="/" aria-label="Gradly home">
          <span className="brand-mark">G<span>✦</span></span>
          <span>gradly</span>
        </a>
        <div className="entry-nav-note"><span className="nav-spark">✳</span> YOUR ACADEMIC SPACE</div>
      </header>

      <section className="entry-center">
        <div className="entry-eyebrow"><span className="eyebrow-line" /> THE STUDENT PLATFORM <span className="eyebrow-line" /></div>
        <div className="entry-title-wrap">
          <p className="entry-kicker">A LITTLE MORE CLARITY. A LOT MORE DIRECTION.</p>
          <h1>Your next chapter<br /><em>starts here.</em></h1>
          <p className="entry-description">Your academic world, in one place. Track your progress, make confident plans and keep moving forward.</p>
        </div>

        <div className="entry-choice">
          <div className="entry-choice-heading"><span>CHOOSE HOW TO CONTINUE</span><i /></div>
          <div className="entry-actions">
            <button className="user-choice" type="button" onClick={handleUserLogin} disabled={loggingIn}>
              <span className="choice-icon"><GoogleMark /></span>
              <span className="choice-copy"><b>{loggingIn ? "Connecting…" : "Continue as User"}</b><small>Sign in with Google for your full student workspace</small></span>
              <span className="choice-arrow">↗</span>
            </button>
            <button className="guest-choice" type="button" onClick={handleGuest}>
              <span className="guest-choice-icon"><span>✦</span></span>
              <span className="choice-copy"><b>Continue as Guest</b><small>Explore SGPA and CGPA calculators without signing in</small></span>
              <span className="choice-arrow">→</span>
            </button>
            <button className="guest-choice tester-choice" type="button" onClick={handleTester}>
              <span className="guest-choice-icon"><span>⌕</span></span>
              <span className="choice-copy"><b>Continue as Tester</b><small>Preview the complete student workspace using an enrollment number</small></span>
              <span className="choice-arrow">→</span>
            </button>
          </div>
          {error && <p className="entry-error" role="alert">{error}</p>}
          <p className="entry-assurance"><span>✧</span> No pressure. Start as a guest and sign in whenever you're ready.</p>
        </div>

        <div className="entry-bottom-note">
          <span className="bottom-dot" /> BUILT FOR YOUR JOURNEY <span className="bottom-separator">/</span> LEARN · TRACK · GROW
        </div>
      </section>

      <div className="floating-card floating-grade" aria-hidden="true">
        <span className="float-label">SEMESTER PERFORMANCE</span>
        <strong>SGPA <b>↗</b></strong>
        <span className="float-meter"><i /></span>
        <small>Every result tells a story.</small>
      </div>
      <div className="floating-card floating-plan" aria-hidden="true">
        <span className="float-plan-icon">✦</span>
        <div><strong>Plan your progress</strong><small>One step at a time.</small></div>
      </div>
      <div className="floating-orb floating-orb-one" aria-hidden="true" />
      <div className="floating-orb floating-orb-two" aria-hidden="true" />

      <footer className="entry-footer">
        <span>© {new Date().getFullYear()} Gradly</span>
        <span>MADE FOR THE WORK BEHIND EVERY RESULT <b>✦</b></span>
      </footer>
    </main>
  );
}
