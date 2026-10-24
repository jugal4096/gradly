import { useAuth } from "../auth/AuthContext";
import "./DashboardPage.css";

const focusAreas = [
  { number: "01", title: "Know your numbers", description: "Bring your academic performance into focus, one semester at a time.", status: "ACADEMIC PLANNING", icon: "↗" },
  { number: "02", title: "Build your next step", description: "Set a clear direction for the academic goals you want to work toward.", status: "GOAL SETTING", icon: "✳" },
  { number: "03", title: "Keep everything in view", description: "A calmer home for your student journey as Gradly’s tools come together.", status: "STUDENT WORKSPACE", icon: "⌘" },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  return (
    <main className="student-dashboard">
      <div className="student-dashboard__glow student-dashboard__glow--one" aria-hidden="true" />
      <div className="student-dashboard__glow student-dashboard__glow--two" aria-hidden="true" />
      <header className="student-topbar">
        <a className="student-brand" href="/dashboard" aria-label="Gradly dashboard">
          <span className="student-brand__mark">G</span><span>gradly<span className="student-brand__dot">.</span></span>
        </a>
        <div className="student-topbar__right">
          <span className="student-status"><i /> PERSONAL WORKSPACE</span>
          <button className="student-signout" type="button" onClick={() => void logout()}>Sign out <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <section className="student-hero" aria-labelledby="student-welcome">
        <div className="student-hero__copy">
          <p className="student-eyebrow"><span /> YOUR ACADEMIC JOURNEY, IN ONE PLACE</p>
          <h1 id="student-welcome">Welcome back{firstName ? <>, <span>{firstName}</span></> : ""}.<br /><em>Let’s make it count.</em></h1>
          <p className="student-hero__description">Your next chapter isn’t written yet. Start with a clearer view of where you are — and where you want to go.</p>
          <div className="student-hero__meta">
            {user?.email && <span className="student-email"><span className="student-email__avatar">{(user.displayName || user.email).slice(0, 1).toUpperCase()}</span><span><small>SIGNED IN AS</small><strong>{user.email}</strong></span></span>}
            <span className="student-secure"><span aria-hidden="true">✦</span> Your account, your space</span>
          </div>
        </div>
        <div className="student-hero__art" aria-hidden="true">
          <div className="student-orbit student-orbit--outer" /><div className="student-orbit student-orbit--inner" />
          <div className="student-glass-card">
            <div className="student-glass-card__top"><span>GRADLY / SPACE</span><span className="student-live-dot" /></div>
            <div className="student-monogram">G<span>.</span></div>
            <div className="student-glass-card__line" /><div className="student-glass-card__line student-glass-card__line--short" />
            <div className="student-glass-card__chips"><i /><i /><i /><i /><i /><i /></div>
            <div className="student-glass-card__caption">YOUR JOURNEY. YOUR PACE.</div>
          </div>
          <span className="student-float student-float--one">✦ &nbsp; A fresh start</span><span className="student-float student-float--two">One step at a time ↗</span>
        </div>
      </section>

      <section className="student-section" aria-labelledby="student-focus-title">
        <div className="student-section__heading"><div><p className="student-eyebrow">THE BIG PICTURE</p><h2 id="student-focus-title">Make room for <em>what’s next.</em></h2></div><span className="student-section__count">YOUR SPACE · 03</span></div>
        <div className="student-focus-grid">
          {focusAreas.map((area, index) => <article className="student-focus-card" key={area.number} style={{ animationDelay: `${index * 100}ms` }}>
            <div className="student-focus-card__top"><span>{area.number}</span><span className="student-focus-card__icon">{area.icon}</span></div>
            <p className="student-focus-card__status">{area.status}</p><h3>{area.title}</h3><p className="student-focus-card__description">{area.description}</p><div className="student-focus-card__rule"><span /></div>
          </article>)}
        </div>
      </section>
      <footer className="student-footer"><span>GRADLY<span className="student-brand__dot">.</span></span><span>Built for the journey, not just the result.</span></footer>
    </main>
  );
}
