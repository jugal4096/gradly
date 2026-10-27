import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpenCheck, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { signInWithGoogle, signOutUser } from "../../config/firebase";
import { studentApi, synchronizeStudent } from "../../lib/studentApi";
import "./StudentPortal.css";

export default function StudentLogin() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function continueWithGoogle() {
    setBusy(true); setError("");
    try {
      const user = await signInWithGoogle();
      await synchronizeStudent(user);
      const result = await studentApi<{ profile: unknown }>("/student/profile", {}, user);
      navigate(result.profile ? "/student/dashboard" : "/student/profile", { replace: true });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not sign in. Please try again.";
      if (/deactivated|deactivate/i.test(message)) await signOutUser().catch(() => undefined);
      setError(message);
    } finally { setBusy(false); }
  }

  const guestUrl = import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5174";
  return <main className="student-auth-page">
    <div className="student-auth-orb orb-one" /><div className="student-auth-orb orb-two" />
    <header className="student-auth-top"><a className="student-brand" href="/"><span className="student-brand-mark"><GraduationCap size={21}/></span><span>gradly<span className="brand-dot">.</span></span></a><span className="student-auth-top-note"><ShieldCheck size={15}/> Student workspace</span></header>
    <section className="student-auth-layout">
      <div className="student-auth-story"><div className="student-eyebrow"><Sparkles size={14}/> YOUR ACADEMIC LIFE, IN ONE PLACE</div><h1>Make every semester <span>count.</span></h1><p>Your personal academic cockpit for grades, goals, planning and progress — built around your curriculum.</p>
        <div className="student-feature-stack"><div className="student-feature-float feature-float-a"><span className="feature-icon lilac"><BookOpenCheck size={20}/></span><div><strong>Academic profile</strong><small>Your branch. Your curriculum. Your journey.</small></div><span className="feature-check">✓</span></div><div className="student-feature-float feature-float-b"><span className="feature-icon blue"><Sparkles size={20}/></span><div><strong>Progress that feels clear</strong><small>Track results and plan the next move.</small></div><span className="feature-mini-chart"><i/><i/><i/><i/><i/></span></div><div className="student-orbit"><div className="orbit-ring ring-a"/><div className="orbit-ring ring-b"/><div className="orbit-core"><GraduationCap size={38}/></div><span className="orbit-star star-a">✦</span><span className="orbit-star star-b">✧</span></div></div>
      </div>
      <div className="student-auth-card-wrap"><div className="student-auth-card"><div className="auth-card-symbol"><GraduationCap size={27}/></div><div className="student-eyebrow">WELCOME TO GRADLY</div><h2>Your next chapter starts here.</h2><p>Sign in to save your profile and unlock the student workspace.</p>
        {error && <div className="student-alert" role="alert">{error}</div>}
        <button className="student-google-button" type="button" onClick={() => void continueWithGoogle()} disabled={busy}>{busy ? <span className="student-spinner"/> : <span className="google-g">G</span>}{busy ? "Connecting securely…" : "Continue with Google"} {!busy && <ArrowRight size={17}/>}</button>
        <div className="student-auth-divider"><span/>or<span/></div><a className="student-guest-link" href={guestUrl}>Try guest mode <ArrowRight size={15}/></a>
        <div className="student-auth-foot"><ShieldCheck size={15}/> Your academic profile is private to your account. Super Admin audit records never include passwords.</div>
      </div><div className="student-card-shadow shadow-one"/><div className="student-card-shadow shadow-two"/></div>
    </section><footer className="student-auth-footer"><span>GRADLY STUDENT SYSTEM</span><span>Learn · Track · Grow</span></footer>
  </main>;
}
