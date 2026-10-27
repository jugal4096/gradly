import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { auth, signOutUser, waitForFirebaseUser } from "../../config/firebase";
import { studentApi, synchronizeStudent } from "../../lib/studentApi";
import "./StudentPortal.css";

type Institution = { id: string; name: string; branches: Array<{ id: string; name: string }> };
type Curriculum = { id: string; institution_id: string; program_name: string; branch_name: string; scheme_name: string; version_label: string; semester_count: number };
type Profile = { id: string; institution_id: string; curriculum_id: string; student_identifier: string; admission_year: number; gap_years: number; current_semester_number: number; graduation_year: number | null; target_cgpa: number | null };
type ProfileForm = { displayName: string; institutionId: string; curriculumId: string; studentIdentifier: string; admissionYear: string; gapYears: string; currentSemesterNumber: string; graduationYear: string; targetCgpa: string };
const emptyForm: ProfileForm = { displayName: "", institutionId: "", curriculumId: "", studentIdentifier: "", admissionYear: String(new Date().getFullYear() - 3), gapYears: "0", currentSemesterNumber: "1", graduationYear: String(new Date().getFullYear() + 1), targetCgpa: "9.0" };
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\\/+$/, "").replace(/\\/api$/i, "");

export default function StudentProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [existing, setExisting] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const availableCurricula = useMemo(() => curricula.filter(item => item.institution_id === form.institutionId), [curricula, form.institutionId]);

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const user = await waitForFirebaseUser();
      if (!user) { navigate("/student/login", { replace: true }); return; }
      await synchronizeStudent(user);
      const [institutionResult, profileResult, curriculumResult] = await Promise.all([
        fetch(API_BASE + "/api/academic/institutions").then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.message || "Could not load institutions."); return result; }),
        studentApi<{ profile: Profile | null }>("/student/profile", {}, user),
        studentApi<{ curricula: Curriculum[] }>("/academic/curricula", {}, user),
      ]);
      setInstitutions(Array.isArray(institutionResult.data) ? institutionResult.data : []);
      setCurricula(Array.isArray(curriculumResult.curricula) ? curriculumResult.curricula : []);
      setExisting(profileResult.profile);
      if (profileResult.profile) {
        const profile = profileResult.profile;
        setForm({ displayName: user.displayName || "", institutionId: profile.institution_id, curriculumId: profile.curriculum_id, studentIdentifier: profile.student_identifier || "", admissionYear: String(profile.admission_year), gapYears: String(profile.gap_years || 0), currentSemesterNumber: String(profile.current_semester_number), graduationYear: profile.graduation_year == null ? "" : String(profile.graduation_year), targetCgpa: profile.target_cgpa == null ? "" : String(profile.target_cgpa) });
      } else setForm(old => ({ ...old, displayName: user.displayName || "" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load your profile."); }
    finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { void loadData(); }, [loadData]);
  const update = (key: keyof ProfileForm, value: string) => setForm(old => ({ ...old, [key]: value, ...(key === "institutionId" ? { curriculumId: "" } : {}) }));
  const selectedCurriculum = availableCurricula.find(item => item.id === form.curriculumId);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const payload = { displayName: form.displayName, institutionId: form.institutionId, curriculumId: form.curriculumId, studentIdentifier: form.studentIdentifier.trim(), admissionYear: Number(form.admissionYear), gapYears: Number(form.gapYears), currentSemesterNumber: Number(form.currentSemesterNumber), graduationYear: form.graduationYear ? Number(form.graduationYear) : null, targetCgpa: form.targetCgpa ? Number(form.targetCgpa) : null };
      const result = await studentApi<{ message: string; profile: Profile }>("/student/profile", { method: existing ? "PUT" : "POST", body: JSON.stringify(payload) });
      setExisting(result.profile); setNotice(result.message || "Profile saved.");
      navigate("/student/dashboard", { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your profile."); }
    finally { setSaving(false); }
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your Gradly account? Sign-in will be disabled. Academic records and the deletion audit remain visible to Super Admin. This cannot be undone from your profile.")) return;
    setSaving(true); setError("");
    try { await studentApi("/student/profile", { method: "DELETE" }); await signOutUser(); navigate("/student/login", { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not deactivate your account."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="student-portal-loading"><div className="student-loader-orbit"/><p>Preparing your academic space…</p></main>;
  const currentUser = auth.currentUser?.displayName || auth.currentUser?.email || "Student";
  return <main className="student-portal-page">
    <header className="student-portal-header"><a className="student-brand" href="/"><span className="student-brand-mark"><GraduationCap size={21}/></span><span>gradly<span className="brand-dot">.</span></span></a><div className="student-header-user"><span className="student-avatar">{currentUser.slice(0,1).toUpperCase()}</span><span>{currentUser}</span><button type="button" onClick={() => void signOutUser().then(() => navigate("/student/login"))}>Sign out</button></div></header>
    <div className="student-profile-shell">
      <button className="student-back-link" type="button" onClick={() => navigate(existing ? "/student/dashboard" : "/student/login")}><ArrowLeft size={16}/>{existing ? "Back to dashboard" : "Back to sign in"}</button>
      <div className="student-profile-heading"><div><div className="student-eyebrow"><Sparkles size={14}/>{existing ? "YOUR DETAILS, YOUR CONTROL" : "LET’S PERSONALIZE YOUR SPACE"}</div><h1>{existing ? "Your student profile" : "Build your academic profile."}</h1><p>Tell Gradly where you study and where you are in your degree. You can edit these details any time.</p></div><div className="student-profile-3d"><div className="profile-3d-ring"/><div className="profile-3d-icon"><GraduationCap size={35}/></div><span>01</span></div></div>
      {error && <div className="student-alert" role="alert">{error}</div>}{notice && <div className="student-success"><CheckCircle2 size={17}/>{notice}</div>}
      <form className="student-profile-form" onSubmit={saveProfile}>
        <section className="student-form-section"><div className="student-form-section-title"><span>01</span><div><h2>About you</h2><p>Your name is optional; your enrollment details identify your academic record.</p></div></div><div className="student-form-grid"><label>Display name<input value={form.displayName} onChange={e => update("displayName", e.target.value)} maxLength={120} placeholder="What should we call you?"/></label><label>Enrollment / roll number *<input required value={form.studentIdentifier} onChange={e => update("studentIdentifier", e.target.value)} maxLength={100} placeholder="Enter your college ID"/></label></div></section>
        <section className="student-form-section"><div className="student-form-section-title"><span>02</span><div><h2>Your academic home</h2><p>Choose the official curriculum that matches your program and branch.</p></div></div><div className="student-form-grid"><label>Institution *<select required value={form.institutionId} onChange={e => update("institutionId", e.target.value)}><option value="">Select your college</option>{institutions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Curriculum / branch *<select required value={form.curriculumId} onChange={e => update("curriculumId", e.target.value)} disabled={!form.institutionId}><option value="">Select program, branch & scheme</option>{availableCurricula.map(item => <option key={item.id} value={item.id}>{item.program_name} · {item.branch_name} · {item.scheme_name || item.version_label} ({item.semester_count || 8} semesters)</option>)}</select></label></div>
          {selectedCurriculum && <div className="student-curriculum-preview"><BookOpen size={17}/><div><strong>{selectedCurriculum.program_name} · {selectedCurriculum.branch_name}</strong><small>{selectedCurriculum.scheme_name || selectedCurriculum.version_label}</small></div><span>{selectedCurriculum.semester_count || 8} semesters</span></div>}
        </section>
        <section className="student-form-section"><div className="student-form-section-title"><span>03</span><div><h2>Your timeline & goals</h2><p>These details help Gradly calculate your progress and plan ahead.</p></div></div><div className="student-form-grid student-form-grid-three"><label>Admission year *<input required type="number" min="1980" max={new Date().getFullYear()+1} value={form.admissionYear} onChange={e => update("admissionYear", e.target.value)}/></label><label>Gap years<input type="number" min="0" max="20" value={form.gapYears} onChange={e => update("gapYears", e.target.value)}/></label><label>Current semester *<select required value={form.currentSemesterNumber} onChange={e => update("currentSemesterNumber", e.target.value)}>{Array.from({length: Math.max(8, selectedCurriculum?.semester_count || 8)}, (_, i) => i+1).map(n => <option key={n} value={String(n)}>Semester {n}</option>)}</select></label><label>Expected graduation year<input type="number" min={Number(form.admissionYear) || 1980} max={(Number(form.admissionYear) || 1980)+20} value={form.graduationYear} onChange={e => update("graduationYear", e.target.value)} placeholder="e.g. 2027"/></label><label>Target CGPA (0–10)<input type="number" min="0" max="10" step="0.01" value={form.targetCgpa} onChange={e => update("targetCgpa", e.target.value)} placeholder="e.g. 9.0"/></label></div></section>
        <div className="student-profile-actions"><div className="student-privacy-note"><ShieldCheck size={18}/><span><strong>You're in control.</strong><small>Profile edits are audited. Deleting your account deactivates access but preserves academic records for Super Admin review.</small></span></div><button className="student-primary-button" disabled={saving || !institutions.length}>{saving ? "Saving your profile…" : existing ? "Save changes" : "Create my profile"}<ArrowRight size={17}/></button></div>
      </form>
      {existing && <div className="student-danger-zone"><div><strong>Delete your Gradly account</strong><p>This deactivates your sign-in. Your academic record and deletion event remain in the Super Admin audit history.</p></div><button type="button" onClick={() => void deleteAccount()} disabled={saving}>Delete account</button></div>}
    </div>
  </main>;
}

