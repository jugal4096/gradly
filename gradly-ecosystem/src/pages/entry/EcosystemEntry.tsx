import { ArrowUpRight, Activity, GraduationCap, Monitor, Settings2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import "./EcosystemEntry.css";

const systems = [
  { href: "/student/login", number: "01", label: "STUDENT SPACE", title: "Your journey.", detail: "Grades, goals, results and a smarter way to plan every semester.", action: "Enter student space", Icon: GraduationCap, className: "student-system-card", status: "PERSONAL WORKSPACE" },
  { href: "/admin/login", number: "02", label: "ACADEMIC OPERATIONS", title: "Keep it moving.", detail: "Manage academic structures, departments, requests and curriculum workflows.", action: "Open admin portal", Icon: Settings2, className: "admin-system-card", status: "OPERATIONS" },
  { href: "/super-admin/login", number: "03", label: "SYSTEM GOVERNANCE", title: "See the whole picture.", detail: "Oversee users, institutions, audit activity and platform configuration.", action: "Open control centre", Icon: ShieldCheck, className: "super-system-card", status: "RESTRICTED ACCESS" },
];

export default function EcosystemEntry() {
  return (
    <main className="ecosystem-home">
      <div className="ecosystem-noise" aria-hidden="true" />
      <div className="ecosystem-ambient ambient-a" aria-hidden="true" />
      <div className="ecosystem-ambient ambient-b" aria-hidden="true" />
      <header className="ecosystem-nav">
        <a className="ecosystem-wordmark" href="/" aria-label="Gradly home">
          <span className="ecosystem-logo-mark"><GraduationCap size={21} strokeWidth={2.1}/></span>
          <span>gradly<span className="ecosystem-wordmark-dot">.</span></span>
          <span className="ecosystem-nav-divider" />
          <span className="ecosystem-nav-product">ECOSYSTEM</span>
        </a>
        <div className="ecosystem-nav-meta"><span className="ecosystem-live-dot"/><span>PLATFORM ONLINE</span><span className="ecosystem-nav-version">V2.0</span></div>
      </header>

      <section className="ecosystem-hero">
        <div className="ecosystem-hero-copy">
          <div className="ecosystem-eyebrow"><span className="ecosystem-eyebrow-line"/><Sparkles size={14}/> ONE PLATFORM. EVERY POSSIBILITY.</div>
          <h1>Make your next<br/>move <span>count.</span></h1>
          <p className="ecosystem-hero-description">Your academic world, thoughtfully connected. Choose your space and get straight to what matters.</p>
          <div className="ecosystem-hero-proof"><span className="ecosystem-proof-icon"><Zap size={15}/></span><span>Built for clarity. Designed for momentum.</span></div>
        </div>

        <div className="ecosystem-hero-visual" aria-label="Decorative three-dimensional Gradly academic emblem">
          <div className="ecosystem-visual-grid"/>
          <div className="ecosystem-visual-halo halo-outer"/><div className="ecosystem-visual-halo halo-inner"/>
          <div className="ecosystem-visual-orbit orbit-one"/><div className="ecosystem-visual-orbit orbit-two"/>
          <div className="ecosystem-glass-cube">
            <div className="ecosystem-cube-face cube-front"><GraduationCap size={57} strokeWidth={1.4}/></div>
            <div className="ecosystem-cube-face cube-top"/>
            <div className="ecosystem-cube-face cube-side"/>
          </div>
          <span className="ecosystem-float-tag tag-academic"><Activity size={14}/> ACADEMIC INTELLIGENCE</span>
          <span className="ecosystem-float-tag tag-progress"><span className="tag-spark">✦</span> YOUR PROGRESS, IN FOCUS</span>
          <span className="ecosystem-visual-star visual-star-one">✦</span><span className="ecosystem-visual-star visual-star-two">✧</span>
        </div>
      </section>

      <section className="ecosystem-systems" aria-labelledby="ecosystem-systems-heading">
        <div className="ecosystem-section-heading">
          <div><span className="ecosystem-section-kicker">CHOOSE YOUR WORKSPACE</span><h2 id="ecosystem-systems-heading">Where would you like to go?</h2></div>
          <span className="ecosystem-section-count">03 <i>/</i> SYSTEMS</span>
        </div>
        <div className="ecosystem-system-grid">
          {systems.map(({ href, number, label, title, detail, action, Icon, className, status }) => (
            <a href={href} key={href} className={"ecosystem-system-card " + className}>
              <div className="ecosystem-card-topline"><span className="ecosystem-card-number">{number}</span><span className="ecosystem-card-status">{status}</span></div>
              <div className="ecosystem-card-icon"><Icon size={25} strokeWidth={1.7}/><span className="ecosystem-icon-glow"/></div>
              <span className="ecosystem-card-label">{label}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
              <div className="ecosystem-card-action"><span>{action}</span><span className="ecosystem-action-icon"><ArrowUpRight size={17}/></span></div>
              <span className="ecosystem-card-shine" aria-hidden="true"/>
            </a>
          ))}
        </div>
      </section>

      <footer className="ecosystem-footer">
        <span className="ecosystem-footer-brand">GRADLY <i>·</i> ACADEMIC ECOSYSTEM</span>
        <span className="ecosystem-footer-centre"><span className="ecosystem-live-dot"/> All systems operational</span>
        <span className="ecosystem-footer-right">LEARN <i>·</i> TRACK <i>·</i> GROW</span>
      </footer>
    </main>
  );
}
