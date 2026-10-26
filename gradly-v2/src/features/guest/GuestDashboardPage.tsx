import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./GuestDashboard.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
type Subject = { id: string; name: string; credits: number; gradePoint: number };
type SemesterEntry = { id: string; sgpa: number; credits: number };
type GuestProfile = { id: string; guestId: string; displayName: string; institutionId?: string; institutionName?: string; expiresAt: string | null };
const GECA_GRADE_SCALE = [
  { label: "A++", value: 10 },
  { label: "A+", value: 9 },
  { label: "A", value: 8 },
  { label: "B+", value: 7 },
  { label: "B", value: 6 },
  { label: "C+", value: 5 },
  { label: "C", value: 4 },
  { label: "D", value: 0 },
] as const;

const initialSubjects: Subject[] = [
  { id: "s1", name: "Subject 01", credits: 4, gradePoint: 9 },
  { id: "s2", name: "Subject 02", credits: 3, gradePoint: 8 },
  { id: "s3", name: "Subject 03", credits: 3, gradePoint: 10 },
];
const lockedFeatures = ["My academic profile", "Curriculum explorer", "Official result import", "Semester-wise history", "Target CGPA planner", "Academic insights", "Study planner & reminders", "AI academic assistant", "Student community"];

function readStoredProfile(): GuestProfile | null {
  try {
    const value = sessionStorage.getItem("gradly_guest_profile");
    return value ? JSON.parse(value) as GuestProfile : null;
  } catch { return null; }
}

export default function GuestDashboardPage() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [profile] = useState<GuestProfile | null>(readStoredProfile);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [semesters, setSemesters] = useState<SemesterEntry[]>([
    { id: "sem1", sgpa: 0, credits: 0 },
    { id: "sem2", sgpa: 0, credits: 0 },
  ]);
  const [notice, setNotice] = useState("");
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"sgpa" | "cgpa">("sgpa");
  const token = sessionStorage.getItem("gradly_guest_session_token");

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    let cancelled = false;
    const storedProfile = readStoredProfile();
    if (!storedProfile) {
      navigate("/login", { replace: true });
      return;
    }
    fetch(`${API_BASE_URL}/api/guest/session`, { headers: { "x-guest-session": token } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || "Guest session expired.");
        if (cancelled) return;
        const guest = data.guest;
        const nextProfile = { ...storedProfile, guestId: guest.guestId ?? storedProfile.guestId, displayName: guest.displayName ?? storedProfile.displayName, institutionId: guest.institutionId ?? storedProfile.institutionId, institutionName: guest.institutionName ?? storedProfile.institutionName, expiresAt: guest.expiresAt };
        sessionStorage.setItem("gradly_guest_profile", JSON.stringify(nextProfile));
        const workspace = guest.workspace;
        if (Array.isArray(workspace?.subjects)) setSubjects(workspace.subjects);
        if (Array.isArray(workspace?.semesters) && workspace.semesters.length) setSemesters(workspace.semesters);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : "Could not restore guest session.");
          sessionStorage.removeItem("gradly_guest_session_token");
          sessionStorage.removeItem("gradly_guest_profile");
        }
      });
    return () => { cancelled = true; };
  }, [navigate, token]);

  async function trackActivity(action: string, metadata: Record<string, string>) {
    const sessionToken = sessionStorage.getItem("gradly_guest_session_token");
    if (!sessionToken) return;
    try {
      await fetch(`${API_BASE_URL}/api/guest/session/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-session": sessionToken },
        body: JSON.stringify({ action, metadata }),
      });
    } catch {
      // Activity telemetry must not interrupt calculator use.
    }
  }

  const sgpa = useMemo(() => {
    const valid = subjects.filter((subject) => subject.credits > 0 && subject.gradePoint >= 0);
    const credits = valid.reduce((sum, subject) => sum + subject.credits, 0);
    return credits ? valid.reduce((sum, subject) => sum + subject.credits * subject.gradePoint, 0) / credits : 0;
  }, [subjects]);
  const cgpa = useMemo(() => {
    const valid = semesters.filter((semester) => semester.credits > 0 && semester.sgpa >= 0 && semester.sgpa <= 10);
    const credits = valid.reduce((sum, semester) => sum + semester.credits, 0);
    return credits ? valid.reduce((sum, semester) => sum + semester.sgpa * semester.credits, 0) / credits : 0;
  }, [semesters]);

  function updateSubject(id: string, key: "name" | "credits" | "gradePoint", value: string) {
    setSubjects((current) => current.map((subject) => subject.id === id ? {
      ...subject,
      [key]: key === "name" ? value : Number(value),
    } : subject));
  }

  async function handleUnlock() {
    try {
      setUnlocking(true);
      await loginWithGoogle();
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
    } finally {
      setUnlocking(false);
    }
  }

  async function saveWorkspace() {
    const sessionToken = sessionStorage.getItem("gradly_guest_session_token");
    if (!sessionToken) { navigate("/login", { replace: true }); return; }
    try {
      setSaving(true);
      setNotice("");
      const response = await fetch(`${API_BASE_URL}/api/guest/session/workspace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-guest-session": sessionToken },
        body: JSON.stringify({ workspace: { subjects, semesters, lastActiveCalculator: activeTab } }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Could not save your work.");
      setNotice("Your calculator work is saved to your guest profile.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save your work.");
    } finally {
      setSaving(false);
    }
  }

  function signOutGuest() {
    sessionStorage.removeItem("gradly_guest_session_token");
    sessionStorage.removeItem("gradly_guest_profile");
    navigate("/login", { replace: true });
  }

  return (
    <main className="guest-app">
      <aside className="guest-sidebar">
        <a className="guest-brand" href="/guest"><span>G</span> GRADLY</a>
        <div className="guest-mode-label"><i /> GUEST WORKSPACE</div>
        <nav className="guest-nav" aria-label="Guest navigation">
          <button className={`guest-nav__item ${activeTab === "sgpa" ? "guest-nav__item--active" : ""}`} onClick={() => { setActiveTab("sgpa"); void trackActivity("GUEST_CALCULATOR_SWITCHED", { calculator: "sgpa" }); }}>◫ <span>SGPA Calculator</span></button>
          <button className={`guest-nav__item ${activeTab === "cgpa" ? "guest-nav__item--active" : ""}`} onClick={() => { setActiveTab("cgpa"); void trackActivity("GUEST_CALCULATOR_SWITCHED", { calculator: "cgpa" }); }}>⌁ <span>CGPA Calculator</span></button>
          {lockedFeatures.map((feature) => <button key={feature} className="guest-nav__item guest-nav__item--locked" onClick={() => { setLockedFeature(feature); void trackActivity("GUEST_FEATURE_LOCK_CLICKED", { feature }); }}><span className="guest-lock">▣</span><span>{feature}</span><span className="guest-nav__lock">LOCKED</span></button>)}
        </nav>
        <div className="guest-sidebar__bottom">
          <div className="guest-avatar">{profile?.displayName?.slice(0, 1).toUpperCase() ?? "G"}</div>
          <div className="guest-sidebar__identity"><strong>{profile?.displayName ?? "Guest"}</strong><span>Guest {profile?.guestId ?? "—"}</span></div>
          <button className="guest-signout" onClick={signOutGuest} aria-label="Exit guest mode" title="Exit guest mode">↗</button>
        </div>
      </aside>
      <section className="guest-main">
        <header className="guest-topbar">
          <div><p className="guest-kicker">YOUR SPACE TO EXPLORE</p><h1>Good to have you here{profile?.displayName ? `, ${profile.displayName}` : ""}.</h1>{profile?.institutionName && <p className="guest-institution-label">INSTITUTION <strong>{profile.institutionName}</strong></p>}</div>
          <div className="guest-id-pill"><span>GUEST ID</span><strong>{profile?.guestId ?? "…"}</strong></div>
        </header>
        <div className="guest-banner"><div><span className="guest-banner__eyebrow">A LITTLE HEAD START</span><h2>Try it out. Find your numbers.</h2><p>Use the calculators freely. Your work stays attached to this guest profile.</p></div><span className="guest-banner__orb" aria-hidden="true">G</span></div>
        <div className="guest-calculator">
          <div className="guest-calculator__header"><div><p className="guest-kicker">QUICK CALCULATORS</p><h2>{activeTab === "sgpa" ? "SGPA calculator" : "CGPA calculator"}</h2></div><div className="guest-tabs"><button className={activeTab === "sgpa" ? "is-active" : ""} onClick={() => setActiveTab("sgpa")}>SGPA</button><button className={activeTab === "cgpa" ? "is-active" : ""} onClick={() => setActiveTab("cgpa")}>CGPA</button></div></div>
          {activeTab === "sgpa" ? (
            <>
              <p className="guest-helper">Use any subject names. Guest Mode does not load institution-specific curriculum or official results.</p>
              <div className="guest-subject-table">
                <div className="guest-table-head"><span>SUBJECT</span><span>CREDITS</span><span>GRADE</span><span /></div>
                {subjects.map((subject) => <div className="guest-subject-row" key={subject.id}>
                  <input aria-label="Subject name" value={subject.name} onChange={(event) => updateSubject(subject.id, "name", event.target.value)} maxLength={80} />
                  <input aria-label={`${subject.name} credits`} type="number" min="0" max="30" step="0.5" value={subject.credits} onChange={(event) => updateSubject(subject.id, "credits", event.target.value)} />
                  <select className="guest-grade-select" aria-label={`${subject.name} grade`} value={String(subject.gradePoint)} onChange={(event) => updateSubject(subject.id, "gradePoint", event.target.value)}>{GECA_GRADE_SCALE.map((grade) => <option key={grade.label} value={grade.value}>{grade.label}</option>)}</select>
                  <button className="guest-remove" aria-label={`Remove ${subject.name}`} onClick={() => { setSubjects((current) => current.filter((item) => item.id !== subject.id)); void trackActivity("GUEST_SUBJECT_REMOVED", { itemType: "subject" }); }}>×</button>
                </div>)}
              </div>
              <div className="guest-calculator__footer"><button className="guest-add" onClick={() => { setSubjects((current) => [...current, { id: crypto.randomUUID(), name: `Subject ${String(current.length + 1).padStart(2, "0")}`, credits: 3, gradePoint: 8 }]); void trackActivity("GUEST_SUBJECT_ADDED", { itemType: "subject" }); }}>＋ Add subject</button><span>GECA grade scale · credits × grade point ÷ total credits</span></div>
            </>
          ) : (
            <>
              <p className="guest-helper">Enter each semester's SGPA and total credits manually. No semester is selected for you.</p>
              <div className="guest-subject-table guest-cgpa-table">
                <div className="guest-table-head"><span>ENTRY</span><span>SGPA (0–10)</span><span>TOTAL CREDITS</span><span /></div>
                {semesters.map((semester, index) => <div className="guest-subject-row" key={semester.id}>
                  <span className="guest-semester-label">Entry {index + 1}</span>
                  <input aria-label={`Entry ${index + 1} SGPA`} type="number" min="0" max="10" step="0.01" value={semester.sgpa} onChange={(event) => setSemesters((current) => current.map((item) => item.id === semester.id ? { ...item, sgpa: Number(event.target.value) } : item))} />
                  <input aria-label={`Entry ${index + 1} credits`} type="number" min="0" max="60" step="0.5" value={semester.credits} onChange={(event) => setSemesters((current) => current.map((item) => item.id === semester.id ? { ...item, credits: Number(event.target.value) } : item))} />
                  <button className="guest-remove" aria-label={`Remove entry ${index + 1}`} onClick={() => { setSemesters((current) => current.filter((item) => item.id !== semester.id)); void trackActivity("GUEST_CGPA_ENTRY_REMOVED", { itemType: "cgpa-entry" }); }}>×</button>
                </div>)}
              </div>
              <div className="guest-calculator__footer"><button className="guest-add" onClick={() => { setSemesters((current) => [...current, { id: crypto.randomUUID(), sgpa: 0, credits: 0 }]); void trackActivity("GUEST_CGPA_ENTRY_ADDED", { itemType: "cgpa-entry" }); }}>＋ Add semester entry</button><span>Weighted by credits</span></div>
            </>
          )}
          <div className="guest-result-row">
            <div><span className="guest-result-row__label">{activeTab === "sgpa" ? "YOUR ESTIMATED SGPA" : "YOUR ESTIMATED CGPA"}</span><strong>{(activeTab === "sgpa" ? sgpa : cgpa).toFixed(2)}<small> / 10</small></strong><span className="guest-result-row__note">Generic estimate · confirm your institution's grading rules</span></div>
            <button className="guest-save" onClick={() => void saveWorkspace()} disabled={saving}>{saving ? "Saving…" : "Save my work"} <span>↗</span></button>
          </div>
          {notice && <p className="guest-notice" role="status">{notice}</p>}
        </div>
        {lockedFeature && (
          <div className="guest-modal-backdrop" role="presentation" onClick={() => setLockedFeature(null)}>
            <section className="guest-lock-modal" role="dialog" aria-modal="true" aria-labelledby="guest-lock-title" onClick={(event) => event.stopPropagation()}>
              <button className="guest-lock-modal__close" onClick={() => setLockedFeature(null)} aria-label="Close dialog">×</button>
              <span className="guest-lock-modal__icon" aria-hidden="true">⌑</span>
              <p className="guest-kicker">A LITTLE MORE IS WAITING</p>
              <h2 id="guest-lock-title">Unlock your Gradly experience</h2>
              <p><strong>{lockedFeature}</strong> is available to registered students. Sign in with Google to build your academic profile and unlock personalized tools.</p>
              <button className="guest-lock-modal__primary" onClick={() => void handleUnlock()} disabled={unlocking}>{unlocking ? "Signing you in…" : "Continue with Google"} <span>↗</span></button>
              <button className="guest-lock-modal__secondary" onClick={() => setLockedFeature(null)}>Keep using Guest Mode</button>
            </section>
          </div>
        )}
        <footer className="guest-disclaimer">Guest calculations are estimates using a generic credit-weighted method. <button onClick={() => setNotice("Sign in with Google to set up your institution, branch, curriculum and personalized academic profile.")}>Unlock full Gradly →</button></footer>
      </section>
    </main>
  );
}
