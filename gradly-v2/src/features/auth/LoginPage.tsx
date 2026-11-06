import { useState, type FormEvent } from "react";
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

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleGoogleLogin() {
    try {
      setError("");
      setLoggingIn(true);
      await loginWithGoogle();
      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      console.error(loginError);
      setError(loginError instanceof Error ? loginError.message : "Google sign-in could not be completed.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setError(""); setLoggingIn(true);
      await loginWithEmail(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      console.error(loginError);
      setError(loginError instanceof Error ? loginError.message : "Email login could not be completed.");
    } finally { setLoggingIn(false); }
  }

  function handleGuest() {
    continueAsGuest();
    navigate("/dashboard", { replace: true });
  }

  return (
    <main className="entry-page">
      <div className="entry-orb entry-orb-one" aria-hidden="true" />
      <div className="entry-orb entry-orb-two" aria-hidden="true" />
      <header className="entry-nav">
        <a className="brand-lockup" href="/" aria-label="Gradly home">
          <span className="brand-mark">G<span>✦</span></span><span>Gradly</span>
        </a>
        <div className="entry-nav-note"><span className="live-dot" /> Your academic journey, in focus</div>
      </header>

      <section className="entry-hero">
        <div className="entry-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> A smarter way to move forward</div>
          <h1>Your next academic<br /><span>breakthrough</span> starts here.</h1>
          <p className="entry-description">One place to understand your progress, explore what’s possible and make your next semester count.</p>
          <div className="entry-actions">
            <button className="google-button" type="button" onClick={handleGoogleLogin} disabled={loggingIn}>
              <GoogleMark /><span>{loggingIn ? "Connecting to Google…" : "Continue with Google"}</span>{!loggingIn && <span className="button-arrow">↗</span>}
            </button>
            <button className="guest-button" type="button" onClick={handleGuest}>Continue as Guest <span aria-hidden="true">→</span></button>
            <button className="email-login-toggle" type="button" onClick={() => { setShowEmailLogin((value) => !value); setError(""); }}>{showEmailLogin ? "Hide email login" : "Login with Email"}</button>
          </div>
          {showEmailLogin && <form className="email-login-form" onSubmit={handleEmailLogin}>
            <label htmlFor="gradly-email">Email address</label>
            <input id="gradly-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            <label htmlFor="gradly-password">Password</label>
            <input id="gradly-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
            <button className="email-submit" type="submit" disabled={loggingIn}>{loggingIn ? "Signing in…" : "Login"}</button>
            <p className="email-login-hint">Use the email and password for an existing Gradly account.</p>
          </form>}
          {error && <p className="entry-error" role="alert">{error}</p>}
          <p className="entry-footnote">No account needed to explore. Your academic workspace is one step away.</p>
          <div className="entry-proof">
            <div className="proof-avatars" aria-hidden="true"><span>A</span><span>R</span><span>S</span><span>+</span></div>
            <p><strong>Built around your progress.</strong><br />Designed for every semester ahead.</p>
          </div>
        </div>

        <div className="preview-wrap" aria-label="Gradly academic dashboard preview">
          <div className="preview-glow" />
          <div className="preview-window">
            <div className="preview-topbar"><div className="preview-brand"><span className="preview-g">G</span> Gradly</div><div className="preview-top-actions"><i /><i /><i /></div></div>
            <div className="preview-content">
              <div className="preview-greeting"><div><span className="preview-kicker">YOUR ACADEMIC SPACE</span><h2>Make progress visible.</h2><p>A clearer view of where you are — and where you can go.</p></div><span className="preview-spark">✦</span></div>
              <div className="preview-metrics">
                <div className="preview-metric"><span>CGPA</span><strong>8.42</strong><small>↗ Academic overview</small></div>
                <div className="preview-metric"><span>Latest SGPA</span><strong>8.76</strong><small>Semester snapshot</small></div>
                <div className="preview-metric"><span>Credits</span><strong>112<span className="metric-total"> / 160</span></strong><small>Degree progress</small></div>
              </div>
              <div className="preview-chart-card">
                <div className="preview-chart-heading"><div><span>ACADEMIC TRAJECTORY</span><strong>Progress over time</strong></div><span className="chart-pill">Illustrative</span></div>
                <div className="preview-chart">
                  <div className="chart-y-labels"><span>10</span><span>8</span><span>6</span><span>4</span></div>
                  <svg viewBox="0 0 480 142" preserveAspectRatio="none" role="img" aria-label="Illustrative upward academic progress graph">
                    <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5b75ff" stopOpacity=".23"/><stop offset="100%" stopColor="#5b75ff" stopOpacity="0"/></linearGradient><linearGradient id="chartLine" x1="0" x2="1"><stop stopColor="#24c5ed"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs>
                    <path d="M0 104 C40 98 50 90 80 93 S130 78 160 83 S210 68 240 73 S290 53 320 61 S370 37 400 43 S450 24 480 18 L480 142 L0 142Z" fill="url(#chartFill)"/>
                    <path d="M0 104 C40 98 50 90 80 93 S130 78 160 83 S210 68 240 73 S290 53 320 61 S370 37 400 43 S450 24 480 18" fill="none" stroke="url(#chartLine)" strokeWidth="3.5" strokeLinecap="round"/>
                    <circle cx="480" cy="18" r="5" fill="#8b5cf6" stroke="#fff" strokeWidth="2"/>
                  </svg>
                  <div className="chart-x-labels"><span>SEM 1</span><span>SEM 2</span><span>SEM 3</span><span>SEM 4</span><span>SEM 5</span><span>SEM 6</span></div>
                </div>
              </div>
              <div className="preview-bottom">
                <div><span className="mini-icon mini-blue">✦</span><span><b>What if?</b><small>Explore grade scenarios</small></span></div>
                <div><span className="mini-icon mini-purple">⌁</span><span><b>Plan ahead</b><small>Map your next milestone</small></span></div>
              </div>
            </div>
          </div>
          <div className="floating-note"><span>✦</span><div><b>Your goals, in view</b><small>Progress meets possibility.</small></div></div>
        </div>
      </section>
      <footer className="entry-footer"><span>© {new Date().getFullYear()} Gradly</span><span className="footer-center">CALCULATE <i>·</i> SIMULATE <i>·</i> PLAN</span><span>Made for your next chapter <b>↗</b></span></footer>
    </main>
  );
}
