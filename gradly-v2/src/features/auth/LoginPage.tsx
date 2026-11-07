import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
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

function LearningPreview() {
  return (
    <div className="learning-stage" aria-label="Preview of the Gradly student workspace">
      <div className="stage-orbit stage-orbit-one" />
      <div className="stage-orbit stage-orbit-two" />
      <div className="stage-floating-note stage-note-top"><span>✦</span><div><b>One clear view</b><small>Your academics, organised</small></div></div>
      <div className="workspace-preview">
        <div className="preview-chrome"><div className="preview-brand"><span className="preview-brand-mark">G</span> gradly <small>STUDENT SPACE</small></div><div className="preview-window-dots"><i/><i/><i/></div></div>
        <div className="preview-body">
          <div className="preview-welcome"><div><span>YOUR LEARNING SPACE</span><h2>Make every<br/><em>semester count.</em></h2><p>A little more clarity. A lot more direction.</p></div><div className="preview-seal">G<span>✦</span></div></div>
          <div className="preview-stat-row"><div><small>ACADEMIC RECORD</small><b>SGPA <i>↗</i></b><span>Understand each result</span></div><div><small>BIG PICTURE</small><b>CGPA <i>↗</i></b><span>Track your progress</span></div></div>
          <div className="preview-course-card"><div className="course-card-head"><span>YOUR NEXT STEP</span><b>01 / 03</b></div><div className="course-progress"><i/></div><div className="course-card-foot"><strong>Plan with purpose.</strong><span>Explore your workspace →</span></div></div>
        </div>
      </div>
      <div className="stage-floating-note stage-note-bottom"><span>✓</span><div><b>Built for students</b><small>Focused on real academic work</small></div></div>
    </div>
  );
}

export default function LoginPage() {
  const { loginWithGoogle, continueAsGuest } = useAuth();
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
      setError(loginError instanceof Error ? loginError.message : "Sign-in could not be completed. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleGuest() {
    continueAsGuest();
    navigate("/dashboard", { replace: true });
  }

  return (
    <main className="entry-page">
      <div className="entry-ambient entry-ambient-one" aria-hidden="true"/>
      <div className="entry-ambient entry-ambient-two" aria-hidden="true"/>
      <header className="entry-nav">
        <a className="brand-lockup" href="/" aria-label="Gradly home"><span className="brand-mark">G<span>✦</span></span><span>gradly</span></a>
        <div className="entry-nav-note"><span className="nav-spark">✳</span> Your academic space, thoughtfully designed</div>
      </header>

      <section className="entry-hero">
        <div className="entry-copy">
          <div className="entry-overline"><span/> THE STUDENT PLATFORM</div>
          <p className="entry-index">A BETTER WAY TO STAY ON TRACK <b>— 01</b></p>
          <h1>Your academic life,<br/><em>in a clearer light.</em></h1>
          <p className="entry-description">Bring your results, plans and academic essentials together. Spend less time figuring things out and more time moving forward.</p>
          <div className="entry-choice-heading"><span>CHOOSE HOW TO CONTINUE</span><i/></div>
          <div className="entry-actions">
            <button className="user-choice" type="button" onClick={handleUserLogin} disabled={loggingIn}>
              <span className="choice-icon"><GoogleMark/></span><span className="choice-copy"><b>{loggingIn ? "Connecting…" : "Continue as User"}</b><small>Sign in to access your full student workspace</small></span><span className="choice-arrow">↗</span>
            </button>
            <button className="guest-choice" type="button" onClick={handleGuest}>
              <span className="guest-choice-icon">↗</span><span className="choice-copy"><b>Continue as Guest</b><small>Try the SGPA and CGPA calculators without signing in</small></span><span className="choice-arrow">→</span>
            </button>
          </div>
          {error && <p className="entry-error" role="alert">{error}</p>}
          <div className="entry-assurance"><span>◇</span><p><b>Your choice, your pace.</b> Guest calculations stay on this device. Sign in whenever you're ready for the complete student experience.</p></div>
        </div>
        <LearningPreview/>
      </section>
      <footer className="entry-footer"><span>© {new Date().getFullYear()} Gradly</span><span>LEARN <i>·</i> TRACK <i>·</i> GROW</span><span>Made for the work behind every result <b>✦</b></span></footer>
    </main>
  );
}
