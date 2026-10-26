import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./LoginPage.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const LOGO_URL = "https://raw.githubusercontent.com/jugal4096/gradly/fix/gradly-audit-2026-10-17/gradly-ecosystem/public/gradly-ecosystem-logo.png";
type GuestInstitution = { id: string; name: string };

export default function LoginPage() {
  const { loginWithGoogle, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [guestSetupOpen, setGuestSetupOpen] = useState(false);
  const [guestSetupStep, setGuestSetupStep] = useState<1 | 2>(1);
  const [guestId, setGuestId] = useState("");
  const [guestInstitutionId, setGuestInstitutionId] = useState("");
  const [institutions, setInstitutions] = useState<GuestInstitution[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [startingGuest, setStartingGuest] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!guestSetupOpen || institutions.length > 0) return;
    let cancelled = false;
    setLoadingInstitutions(true);
    fetch(`${API_BASE_URL}/api/guest/institutions`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || "Could not load institutions.");
        if (!cancelled) setInstitutions(Array.isArray(data?.institutions) ? data.institutions : []);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load institutions.");
      })
      .finally(() => { if (!cancelled) setLoadingInstitutions(false); });
    return () => { cancelled = true; };
  }, [guestSetupOpen, institutions.length]);

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

  function continueGuestSetup() {
    const normalizedGuestId = guestId.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{3,23}$/.test(normalizedGuestId)) {
      setError("Guest ID must be 4–24 characters using letters, numbers, hyphens or underscores.");
      return;
    }
    setGuestId(normalizedGuestId);
    setError("");
    setGuestSetupStep(2);
  }

  async function handleGuestStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guestSetupStep !== 2) return;
    const normalizedGuestId = guestId.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{3,23}$/.test(normalizedGuestId)) {
      setError("Guest ID must be 4–24 characters using letters, numbers, hyphens or underscores.");
      return;
    }
    if (!guestInstitutionId) {
      setError("Select your institution to continue.");
      return;
    }
    try {
      setError("");
      setStartingGuest(true);
      const response = await fetch(`${API_BASE_URL}/api/guest/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: normalizedGuestId, institutionId: guestInstitutionId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "We couldn't start Guest Mode. Please try again.");
      const guest = data.guest;
      sessionStorage.setItem("gradly_guest_session_token", guest.sessionToken);
      sessionStorage.setItem("gradly_guest_profile", JSON.stringify({
        id: guest.id,
        guestId: guest.guestId,
        displayName: guest.displayName,
        institutionId: guest.institutionId,
        institutionName: guest.institutionName,
        expiresAt: guest.expiresAt,
      }));
      navigate("/guest", { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Guest Mode could not be started.";
      setError(message);
      if (message.toLowerCase().includes("guest id is already in use")) setGuestSetupStep(1);
    } finally {
      setStartingGuest(false);
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
          <p className="hero-description">Track your progress, understand your results, and move toward your goals with confidence.</p>
          <p className="auth-prompt">Get started with Gradly</p>
          <div className="hero-actions hero-actions--minimal">
            <button className="button-primary google-button" onClick={handleGoogleLogin} disabled={loggingIn || startingGuest}>
              <svg className="google-mark" viewBox="0 0 48 48" role="img" aria-label="Google logo">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.65 5.93c4.46-4.12 7.13-10.2 7.13-17.58Z"/>
                <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.87l-7.65-5.93c-2.13 1.43-4.85 2.28-8.25 2.28-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 43.62 14.62 48 24 48Z"/>
              </svg>
              <span>{loggingIn ? "Signing in…" : "Continue with Google"}</span>
            </button>
            <button className="button-quiet" onClick={() => { setError(""); setGuestSetupOpen(true); document.getElementById("guest-entry")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); }} disabled={loggingIn || startingGuest}>
              Continue as Guest <span aria-hidden="true">→</span>
            </button>
          </div>
          {error && <p className="landing-error" role="alert">{error}</p>}
          <div className="guest-entry guest-entry--minimal" id="guest-entry">
            {!guestSetupOpen ? null : <form className="guest-setup" onSubmit={handleGuestStart}>
              <div className="guest-setup__heading">
                <span className="guest-setup__step">STEP {guestSetupStep} OF 2</span>
                <strong>{guestSetupStep === 1 ? "Create your guest identity" : "Choose your institution"}</strong>
                <p>{guestSetupStep === 1 ? "Pick a unique ID to identify your guest workspace." : "Your institute is saved to your profile; calculators remain generic and open to everyone."}</p>
              </div>
              {guestSetupStep === 1 ? <>
                <label htmlFor="guest-id">Choose a unique Guest ID</label>
                <input className="guest-setup__full-input" id="guest-id" value={guestId} onChange={(event) => setGuestId(event.target.value.replace(/\\s/g, "").toUpperCase())} minLength={4} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9_-]{3,23}" placeholder="e.g. JUGAL-01" autoComplete="off" required />
                <small className="guest-setup__hint">4–24 characters · letters, numbers, hyphens or underscores</small>
                <button className="guest-setup__submit" type="button" onClick={continueGuestSetup}>Continue to institution <span aria-hidden="true">→</span></button>
              </> : <>
                <div className="guest-setup__chosen-id"><span>YOUR GUEST ID</span><strong>{guestId}</strong><button type="button" onClick={() => { setError(""); setGuestSetupStep(1); }}>Edit</button></div>
                <label htmlFor="guest-institution">Select your institution</label>
                <select id="guest-institution" value={guestInstitutionId} onChange={(event) => setGuestInstitutionId(event.target.value)} required disabled={loadingInstitutions || startingGuest}>
                  <option value="">{loadingInstitutions ? "Loading institutions…" : "Choose an institution"}</option>
                  {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                </select>
                {!loadingInstitutions && institutions.length === 0 && <small className="guest-setup__hint">No institutions are available yet. Please try again later.</small>}
                <button className="guest-setup__submit" type="submit" disabled={startingGuest || loggingIn || loadingInstitutions || institutions.length === 0 || !guestInstitutionId}>{startingGuest ? "Creating workspace…" : "Create guest workspace"} <span aria-hidden="true">↗</span></button>
              </>}
              <p className="guest-setup__privacy">Your calculator work and guest activity are recorded for Super Admin review.</p>
            </form>}
          </div>
        </div>
      </section>
      <footer className="landing-footer landing-footer--minimal">
        <a className="landing-footer__brand" href="#home">gradly<span>.</span></a>
        <span>MADE FOR YOUR JOURNEY.</span>
      </footer>
    </main>
  );
}
