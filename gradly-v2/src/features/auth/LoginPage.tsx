import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./LoginPage.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const LOGO_URL = "https://raw.githubusercontent.com/jugal4096/gradly/fix/gradly-audit-2026-10-17/gradly-ecosystem/public/gradly-ecosystem-logo.png";

const galleryImages = [
  "photo-1523050854058-8df90110c9f1",
  "photo-1523240795612-9a054b0db644",
  "photo-1517486808906-6ca8b3f04846",
  "photo-1434030216411-0b793f4b4173",
  "photo-1523580846011-d3a5bc25702b",
  "photo-1529390079861-591de354faf5",
];

function ImageRail({ side }: { side: "left" | "right" }) {
  const images = side === "left" ? galleryImages : [...galleryImages].reverse();
  return (
    <div className={`login-rail login-rail--${side}`} aria-hidden="true">
      <div className="login-rail__track">
        {[...images, ...images].map((image, index) => (
          <div
            className={`login-rail__tile login-rail__tile--${index % 6}`}
            key={`${side}-${image}-${index}`}
            style={{ backgroundImage: `url(https://images.unsplash.com/${image}?auto=format&fit=crop&w=900&q=85)` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { loginWithGoogle, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [guestSetupOpen, setGuestSetupOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [startingGuest, setStartingGuest] = useState(false);

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

  async function handleGuestStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = guestName.trim();
    if (displayName.length < 3 || displayName.length > 24) {
      setError("Choose a display name between 3 and 24 characters.");
      return;
    }

    try {
      setError("");
      setStartingGuest(true);
      const response = await fetch(`${API_BASE_URL}/api/guest/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "We couldn't start Guest Mode. Please try again.");

      sessionStorage.setItem("gradly_guest_session_token", data.guest.sessionToken);
      sessionStorage.setItem("gradly_guest_profile", JSON.stringify({
        id: data.guest.id,
        guestId: data.guest.guestId,
        displayName: data.guest.displayName,
        expiresAt: data.guest.expiresAt,
      }));
      navigate("/guest", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Guest Mode could not be started.");
    } finally {
      setStartingGuest(false);
    }
  }

  return (
    <main className="gradly-login">
      <div className="login-ambient login-ambient--one" aria-hidden="true" />
      <div className="login-ambient login-ambient--two" aria-hidden="true" />
      <ImageRail side="left" />
      <ImageRail side="right" />

      <header className="login-topbar">
        <a className="gradly-logo-link" href="/" aria-label="Gradly home">
          <img className="gradly-logo-image" src={LOGO_URL} alt="Gradly" />
        </a>
      </header>

      <section className="login-content" aria-labelledby="login-title">
        <p className="login-eyebrow"><span /> YOUR ACADEMIC STORY STARTS HERE <span /></p>
        <h1 id="login-title" className="login-title">
          <span className="login-title__line">Make every</span>
          <span className="login-title__line login-title__line--accent">semester count.</span>
        </h1>
        <p className="login-description">
          Your grades, your goals, your next big move — all in one place.
          Meet the academic sidekick that moves with you.
        </p>

        <div className="login-actions">
          <button className="login-button login-button--google" onClick={handleGoogleLogin} disabled={loggingIn || startingGuest}>
            <span className="google-g" aria-hidden="true">G</span>
            <span>{loggingIn ? "Signing you in…" : "Continue with Google"}</span>
            {!loggingIn && <span className="login-button__arrow" aria-hidden="true">↗</span>}
          </button>
          {!guestSetupOpen ? (
            <button className="login-button login-button--guest" onClick={() => { setError(""); setGuestSetupOpen(true); }}>
              Explore as Guest <span aria-hidden="true">→</span>
            </button>
          ) : (
            <form className="guest-setup" onSubmit={handleGuestStart}>
              <label htmlFor="guest-name">Choose your guest display name</label>
              <div className="guest-setup__row">
                <input id="guest-name" value={guestName} onChange={(event) => setGuestName(event.target.value)}
                  minLength={3} maxLength={24} placeholder="e.g. curiouslearner" autoComplete="nickname" autoFocus required />
                <button type="submit" disabled={startingGuest || loggingIn}>{startingGuest ? "Creating…" : "Enter"}</button>
              </div>
              <p>Your unique Guest ID will be assigned automatically.</p>
            </form>
          )}
          {error && <p className="login-error" role="alert">{error}</p>}
        </div>
        <p className="login-privacy">Guest mode saves your calculator work to Gradly. Use Google sign-in to unlock your personalized academic profile.</p>
      </section>

      <footer className="login-footer">
        <span className="login-footer__spark" />
        <span>BUILT FOR THE NEXT VERSION OF YOU.</span>
        <span className="login-footer__spark" />
      </footer>
    </main>
  );
}
