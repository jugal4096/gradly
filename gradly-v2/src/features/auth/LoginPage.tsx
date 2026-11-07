import { useEffect, useState } from "react";
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
  const { loginWithGoogle, createGuestIdentity } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);\n  const [guestSetup, setGuestSetup] = useState(false);\n  const [guestId, setGuestId] = useState("");\n  const [availability, setAvailability] = useState<"idle"|"checking"|"available"|"taken"|"invalid">("idle");

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

  useEffect(() => {
    const value = guestId.trim();
    if (!guestSetup || !value) { setAvailability("idle"); return; }
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{3,23}$/.test(value)) { setAvailability("invalid"); return; }
    setAvailability("checking");
    const timer = window.setTimeout(async () => {
      try {
        const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
        const response = await fetch(`${base}/api/guest/guest-id-availability?guestId=${encodeURIComponent(value)}`);
        const data = await response.json().catch(() => ({}));
        setAvailability(response.ok && data.available ? "available" : response.status === 409 || data.valid ? "taken" : "invalid");
      } catch { setAvailability("idle"); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [guestId, guestSetup]);

  async function handleGuestCreate() {
    if (availability !== "available") return;
    try {
      setError("");
      setLoggingIn(true);
      await createGuestIdentity(guestId.trim());
      navigate("/dashboard", { replace: true });
    } catch (guestError) {
      setError(guestError instanceof Error ? guestError.message : "Guest identity could not be created.");
      setAvailability("idle");
    } finally { setLoggingIn(false); }
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
          <div className="entry-access-kicker">ACADEMIC TOOLS, WITHOUT THE CLUTTER</div>
          <div className="eyebrow"><span className="eyebrow-line" /> A smarter way to move forward</div>
          <h1>Your next academic<br /><span>breakthrough</span> starts here.</h1>
          <p className="entry-description">One place to understand your progress, explore what’s possible and make your next semester count.</p>
          {guestSetup ? (
            <div className="guest-identity-panel">
              <button className="guest-back" type="button" onClick={() => { setGuestSetup(false); setError(""); }}>← Back</button>
              <h2>Create Your Guest Identity</h2>
              <p>Your Guest ID will identify your saved academic workspace.</p>
              <label htmlFor="guest-id-input">Choose a Guest ID</label>
              <input id="guest-id-input" autoComplete="off" maxLength={24} value={guestId} onChange={e => setGuestId(e.target.value)} placeholder="e.g. JUGAL2026" />
              <small>4–24 characters · letters, numbers, hyphens or underscores</small>
              <p className={`guest-id-status guest-id-${availability}`} role="status">
                {availability === "checking" ? "Checking availability…" : availability === "available" ? "✓ This Guest ID is available" : availability === "taken" ? "This Guest ID is already taken" : availability === "invalid" ? "Enter a valid Guest ID" : "Choose your unique ID to check availability"}
              </p>
              <button className="google-button guest-create-button" type="button" onClick={handleGuestCreate} disabled={availability !== "available" || loggingIn}>
                {loggingIn ? "Creating your identity…" : "Create Guest Identity →"}
              </button>
            </div>
          ) : (
            <div className="entry-actions">
              <button className="google-button" type="button" onClick={handleGoogleLogin} disabled={loggingIn}>
                <GoogleMark /><span>{loggingIn ? "Connecting to Google…" : "Continue with Google"}</span>{!loggingIn && <span className="button-arrow">↗</span>}
              </button>
              <button className="guest-button" type="button" onClick={() => setGuestSetup(true)}>Continue as a guest <span aria-hidden="true">→</span></button>
            </div>
          )}
          {error && <p className="entry-error" role="alert">{error}</p>}
          <p className="entry-footnote">Choose how you want to use Gradly. Guest access is limited to manual SGPA and CGPA calculations; sign in to unlock the full student experience.</p>
          <div className="entry-proof">
            <div className="proof-avatars" aria-hidden="true"><span>A</span><span>R</span><span>S</span><span>+</span></div>
            <p><strong>Built around your progress.</strong><br />Designed for every semester ahead.</p>
          </div>
        </div>

        <div className="entry-visual">
          <div className="entry-visual-glow" />
          <div className="entry-visual-brand"><span className="entry-visual-mark">G</span><span>GRADLY <small>ACADEMIC COMPANION</small></span></div>
          <div className="entry-visual-title">Your effort.<br/><em>Your progress.</em><br/>Your next chapter.</div>
          <div className="entry-visual-rule" />
          <div className="entry-visual-features"><span>01 <b>Calculate</b><small>SGPA & CGPA</small></span><span>02 <b>Understand</b><small>Credit-weighted results</small></span><span>03 <b>Move forward</b><small>One semester at a time</small></span></div>
          <div className="entry-visual-caption">MADE FOR STUDENTS · BUILT AROUND ACADEMICS</div>
        </div>
      </section>
      <footer className="entry-footer"><span>© {new Date().getFullYear()} Gradly</span><span className="footer-center">CALCULATE <i>·</i> SIMULATE <i>·</i> PLAN</span><span>Made for your next chapter <b>↗</b></span></footer>
    </main>
  );
}


/* Guest identity setup: deliberately compact and mobile-first. */
