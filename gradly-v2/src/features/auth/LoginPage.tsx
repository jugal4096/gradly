import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./LoginPage.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const LOGO_URL = "https://raw.githubusercontent.com/jugal4096/gradly/fix/gradly-audit-2026-10-17/gradly-ecosystem/public/gradly-ecosystem-logo.png";

const capabilities = [
  { number: "01", icon: "↗", title: "Know your numbers", body: "Make sense of SGPA, CGPA and the academic picture behind every result.", tag: "ACADEMIC CLARITY" },
  { number: "02", icon: "⌁", title: "Plan with purpose", body: "Turn a big target into a next step that feels clear, realistic and yours.", tag: "GOAL SETTING" },
  { number: "03", icon: "✳", title: "Keep your momentum", body: "Bring your academic journey into one calmer space, semester by semester.", tag: "YOUR WORKSPACE" },
];
const steps = [
  { number: "01", title: "Start where you are", body: "Sign in with Google or try Gradly in Guest Mode. No complicated setup." },
  { number: "02", title: "Make the picture clearer", body: "Explore your academic numbers and begin shaping your next goal." },
  { number: "03", title: "Keep moving forward", body: "Build a more intentional student routine, one useful step at a time." },
];

export default function LoginPage() {
  const { loginWithGoogle, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [guestSetupOpen, setGuestSetupOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [startingGuest, setStartingGuest] = useState(false);
  const [email, setEmail] = useState("");
  const [waitlistNotice, setWaitlistNotice] = useState("");

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
        id: data.guest.id, guestId: data.guest.guestId,
        displayName: data.guest.displayName, expiresAt: data.guest.expiresAt,
      }));
      navigate("/guest", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Guest Mode could not be started.");
    } finally {
      setStartingGuest(false);
    }
  }

  function handleWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setWaitlistNotice("Email updates aren’t connected yet, so nothing was sent or saved. You can start using Gradly with Google or Guest Mode today.");
  }

  return (
    <main className="gradly-landing">
      <div className="landing-noise" aria-hidden="true" />
      <header className="landing-nav">
        <a className="landing-brand" href="#home" aria-label="Gradly home">
          <img src={LOGO_URL} alt="Gradly" />
          <span className="landing-brand__fallback" aria-hidden="true">gradly<span>.</span></span>
        </a>
        <nav className="landing-nav__links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#about">Our idea</a>
        </nav>
        <button className="landing-nav__cta" onClick={() => document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" })}>
          Get started <span aria-hidden="true">↗</span>
        </button>
      </header>

      <section className="landing-hero" id="home" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="landing-eyebrow"><span className="eyebrow-pulse" /> YOUR ACADEMIC SIDEKICK</p>
          <h1 id="hero-title">Make your next<br />chapter <span>count.</span></h1>
          <p className="hero-description">Your grades are part of the story. Not the whole story. Gradly helps you bring your academic goals, progress and next steps into focus.</p>
          <div className="hero-actions">
            <button className="button-primary" onClick={handleGoogleLogin} disabled={loggingIn || startingGuest}>
              {loggingIn ? "Signing you in…" : "Start with Google"} <span aria-hidden="true">↗</span>
            </button>
            <button className="button-quiet" onClick={() => { setError(""); setGuestSetupOpen(true); document.getElementById("guest-entry")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
              Explore as guest <span aria-hidden="true">→</span>
            </button>
          </div>
          {error && <p className="landing-error" role="alert">{error}</p>}
          <div className="hero-trust"><span className="trust-check">✓</span><span>Start at your own pace</span><i /> <span>No pressure. Just progress.</span></div>
        </div>
        <div className="hero-visual" aria-label="Abstract animated blue Gradly visual">
          <div className="visual-grid" aria-hidden="true" />
          <div className="visual-halo visual-halo--outer" aria-hidden="true" />
          <div className="visual-halo visual-halo--inner" aria-hidden="true" />
          <div className="visual-orbit visual-orbit--one" aria-hidden="true"><span /></div>
          <div className="visual-orbit visual-orbit--two" aria-hidden="true"><span /></div>
          <div className="visual-core" aria-hidden="true">
            <div className="core-ring core-ring--one" /><div className="core-ring core-ring--two" />
            <div className="core-mark">G<span>.</span></div>
            <div className="core-caption">GROW AT YOUR PACE</div>
          </div>
          <div className="visual-chip visual-chip--top"><span className="chip-dot" /><span>YOUR NEXT CHAPTER</span></div>
          <div className="visual-chip visual-chip--bottom"><span className="chip-spark">✳</span><span><strong>Progress, not pressure.</strong><small>One step at a time.</small></span></div>
          <span className="visual-coordinate visual-coordinate--one">18° 31' N</span>
          <span className="visual-coordinate visual-coordinate--two">ACADEMIC / 001</span>
        </div>
        <a className="hero-scroll" href="#features"><span /> SCROLL TO EXPLORE <b aria-hidden="true">↓</b></a>
      </section>

      <section className="landing-intro" id="about" aria-labelledby="intro-title">
        <div className="section-label"><span>01</span> THE GRADLY MINDSET</div>
        <div className="intro-layout">
          <h2 id="intro-title">A little more clarity.<br /><em>A lot more possibility.</em></h2>
          <div className="intro-copy"><p>Student life can feel like a hundred tabs open at once. Gradly is being built to make the academic side of that journey feel a little more organised — and a little more yours.</p><a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↘</span></a></div>
        </div>
        <div className="intro-line" aria-hidden="true"><span /></div>
      </section>

      <section className="landing-features" id="features" aria-labelledby="features-title">
        <div className="section-heading">
          <div><div className="section-label"><span>02</span> MADE FOR YOUR JOURNEY</div><h2 id="features-title">Less noise.<br /><em>More direction.</em></h2></div>
          <p>Useful tools and a clearer view of your progress — designed around the student, not just the score.</p>
        </div>
        <div className="feature-grid">
          {capabilities.map((feature) => <article className="feature-card" key={feature.number}>
            <div className="feature-card__top"><span>{feature.number}</span><span className="feature-card__icon" aria-hidden="true">{feature.icon}</span></div>
            <p className="feature-card__tag">{feature.tag}</p><h3>{feature.title}</h3><p className="feature-card__body">{feature.body}</p>
            <div className="feature-card__bottom"><span>EXPLORE THE POSSIBILITIES</span><span aria-hidden="true">↗</span></div>
          </article>)}
        </div>
      </section>

      <section className="landing-steps" id="how-it-works" aria-labelledby="steps-title">
        <div className="steps-visual" aria-hidden="true">
          <div className="steps-orbit steps-orbit--one" /><div className="steps-orbit steps-orbit--two" />
          <div className="steps-monogram">g<span>.</span></div>
          <div className="steps-caption">SMALL STEPS. REAL MOMENTUM.</div>
        </div>
        <div className="steps-content">
          <div className="section-label"><span>03</span> SIMPLE BY DESIGN</div>
          <h2 id="steps-title">Your journey.<br /><em>Your pace.</em></h2>
          <div className="steps-list">
            {steps.map((step) => <article className="step-row" key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.body}</p></div><span className="step-arrow" aria-hidden="true">↗</span></article>)}
          </div>
        </div>
      </section>

      <section className="landing-start" id="get-started" aria-labelledby="start-title">
        <div className="start-glow" aria-hidden="true" />
        <div className="section-label"><span>04</span> YOUR NEXT CHAPTER STARTS HERE</div>
        <h2 id="start-title">Ready when<br /><em>you are.</em></h2>
        <p>Start with what you have. Figure out the next step as you go.</p>
        <div className="start-actions">
          <button className="button-primary" onClick={handleGoogleLogin} disabled={loggingIn || startingGuest}>{loggingIn ? "Signing you in…" : "Continue with Google"} <span aria-hidden="true">↗</span></button>
          <button className="button-quiet" onClick={() => { setGuestSetupOpen(true); document.getElementById("guest-entry")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Try Guest Mode <span aria-hidden="true">→</span></button>
        </div>
        <div className="start-email">
          <form onSubmit={handleWaitlist}>
            <label htmlFor="updates-email">Prefer email updates?</label>
            <div className="email-row"><input id="updates-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setWaitlistNotice(""); }} required /><button type="submit">Get updates <span aria-hidden="true">↗</span></button></div>
          </form>
          <p className="email-note" role={waitlistNotice ? "status" : undefined}>{waitlistNotice || "Email updates are not connected yet. Submitting will not send or store your email."}</p>
        </div>
        <div className="guest-entry" id="guest-entry">
          {!guestSetupOpen ? <button className="guest-entry__toggle" onClick={() => setGuestSetupOpen(true)}>Or set up a guest workspace <span aria-hidden="true">＋</span></button> : <form className="guest-setup" onSubmit={handleGuestStart}>
            <label htmlFor="guest-name">Choose your guest display name</label>
            <div className="guest-setup__row"><input id="guest-name" value={guestName} onChange={(event) => setGuestName(event.target.value)} minLength={3} maxLength={24} placeholder="e.g. curiouslearner" autoComplete="nickname" required /><button type="submit" disabled={startingGuest || loggingIn}>{startingGuest ? "Creating…" : "Enter Guest Mode"} <span aria-hidden="true">↗</span></button></div>
            <p>Your unique Guest ID will be assigned automatically.</p>
          </form>}
        </div>
        {error && <p className="landing-error landing-error--center" role="alert">{error}</p>}
      </section>

      <footer className="landing-footer">
        <a className="landing-footer__brand" href="#home">gradly<span>.</span></a>
        <span>BUILT FOR THE JOURNEY, NOT JUST THE RESULT.</span>
        <a href="#home">BACK TO TOP ↑</a>
      </footer>
    </main>
  );
}
