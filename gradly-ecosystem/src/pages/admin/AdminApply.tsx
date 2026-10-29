import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ArrowRight, CheckCircle2, ClipboardList, GraduationCap, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth, signInWithGoogle, signOutUser } from "../../config/firebase";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import "./AdminApply.css";

type Branch = { id: string; name: string };
type Institution = { id: string; name: string; branches: Branch[] };
type Application = {
  id: string;
  full_name: string;
  institution_id: string;
  branch_id: string;
  institution_name?: string;
  branch_name?: string;
  enrollment_number: string;
  status: string;
  created_at: string;
  rejection_reason?: string | null;
};

const statusLabel = (status: string) => status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminApply() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    enrollment_number: "",
    mobile_number: "",
    graduation_date: "",
    qualification: "",
    reason: "",
    additional_note: "",
  });

  const selectedInstitution = useMemo(
    () => institutions.find((item) => item.id === institutionId),
    [institutions, institutionId],
  );
  const branches = selectedInstitution?.branches ?? [];

  const loadApplications = useCallback(async (activeUser: User) => {
    if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
    const token = await activeUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/admin-applications/mine`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const result = await response.json().catch(() => null) as { applications?: Application[]; message?: string } | null;
    if (!response.ok) throw new Error(result?.message || `Unable to load your applications (HTTP ${response.status}).`);
    if (!Array.isArray(result?.applications)) throw new Error("The application service returned an unexpected response.");
    setApplications(result.applications);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (activeUser) => {
      if (cancelled) return;
      setUser(activeUser);
      setAuthLoading(false);
      setError("");
      if (!activeUser) {
        setApplications([]);
        setLoading(false);
        return;
      }
      setForm((previous) => ({
        ...previous,
        full_name: previous.full_name || activeUser.displayName || "",
      }));
      setLoading(true);
      try {
        if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
        const token = await activeUser.getIdToken();
        const syncResponse = await fetch(`${API_BASE_URL}/api/auth/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!syncResponse.ok) {
          const syncResult = await syncResponse.json().catch(() => null) as { message?: string } | null;
          throw new Error(syncResult?.message || "Unable to synchronize your Gradly account. Please sign in again.");
        }
        await loadApplications(activeUser);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load your applications.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadApplications]);

  useEffect(() => {
    let cancelled = false;
    async function loadInstitutions() {
      try {
        if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
        const response = await fetch(`${API_BASE_URL}/api/academic/institutions`, { headers: { Accept: "application/json" } });
        const result = await response.json().catch(() => null) as { data?: Institution[]; message?: string } | null;
        if (!response.ok || !Array.isArray(result?.data)) {
          throw new Error(result?.message || "Unable to load institutions and branches.");
        }
        if (!cancelled) setInstitutions(result.data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load institutions.");
      }
    }
    void loadInstitutions();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!user) {
      setError("Sign in with Google before submitting an application.");
      return;
    }
    if (!institutionId || !branchId) {
      setError("Select an institution and one of its branches.");
      return;
    }
    if (!isApiConfigured) {
      setError(API_CONFIGURATION_ERROR);
      return;
    }
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/admin-applications`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...form,
          institution_id: institutionId,
          branch_id: branchId,
        }),
      });
      const result = await response.json().catch(() => null) as { success?: boolean; message?: string } | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to submit your application (HTTP ${response.status}).`);
      }
      setNotice(result.message || "Your administrator application was submitted.");
      await loadApplications(user);
      setForm((previous) => ({ ...previous, enrollment_number: "", mobile_number: "", graduation_date: "", qualification: "", reason: "", additional_note: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit your application.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in was unsuccessful.");
    }
  }

  return (
    <div className="admin-apply-page">
      <header className="admin-header">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div><div className="brand-name">Gradly</div><div className="brand-subtitle">Ecosystem administration</div></div>
        </div>
        <span className="system-badge">ADMIN ACCESS APPLICATION</span>
      </header>

      <main className="admin-main">
        <div className="page-container">
          <section className="page-intro">
            <div className="intro-system-icon"><GraduationCap size={27} /></div>
            <div className="intro-content">
              <div className="micro-label">ADMINISTRATOR ONBOARDING</div>
              <h1>Apply for administrator access</h1>
              <p>Submit your details for review. Administrative access is granted only after the Super Admin team reviews your application.</p>
            </div>
          </section>

          {error && <div className="system-alert" role="alert"><span className="alert-icon">!</span><span>{error}</span></div>}
          {notice && <div className="system-alert" role="status"><CheckCircle2 size={18} /><span>{notice}</span></div>}

          {!authLoading && !user && (
            <section className="success-card auth-card">
              <h2>Sign in to continue</h2>
              <p className="success-description">Use your Google account to submit an application and track its review status.</p>
              <button className="google-sign-in-button" type="button" onClick={() => void handleGoogleSignIn()}><span className="google-g">G</span> Continue with Google <ArrowRight size={17} /></button>
              <p className="auth-privacy-note">Your authenticated account email is used for application correspondence.</p>
            </section>
          )}

          {user && (
            <>
              <section className="success-card">
                <h2>Application details</h2>
                <p className="success-description">Signed in as <strong>{user.email || "Google account"}</strong>. Complete the form below; fields marked required are validated by the server too.</p>
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="form-field"><label htmlFor="full-name">Full name *</label><input id="full-name" autoComplete="name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required /></div>
                    <div className="form-field"><label htmlFor="enrollment-number">Enrollment number *</label><input id="enrollment-number" value={form.enrollment_number} onChange={(event) => setForm({ ...form, enrollment_number: event.target.value })} required /></div>
                    <div className="form-field"><label htmlFor="mobile-number">Mobile number *</label><input id="mobile-number" type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit Indian mobile number" value={form.mobile_number} onChange={(event) => setForm({ ...form, mobile_number: event.target.value })} required /></div>
                    <div className="form-field"><label htmlFor="graduation-date">Graduation date *</label><input id="graduation-date" type="date" min={new Date().toISOString().slice(0, 10)} value={form.graduation_date} onChange={(event) => setForm({ ...form, graduation_date: event.target.value })} required /></div>
                    <div className="form-field"><label htmlFor="institution">Institution *</label><select id="institution" value={institutionId} onChange={(event) => { setInstitutionId(event.target.value); setBranchId(""); }} required><option value="">Choose institution</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                    <div className="form-field"><label htmlFor="branch">Branch / department *</label><select id="branch" value={branchId} onChange={(event) => setBranchId(event.target.value)} required disabled={!institutionId}><option value="">Choose branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
                    <div className="form-field"><label htmlFor="qualification">Qualification</label><input id="qualification" value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} placeholder="e.g. B.Tech, M.Tech" /></div>
                    <div className="form-field"><label htmlFor="reason">Why are you applying?</label><textarea id="reason" rows={3} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Briefly describe your experience or motivation." /></div>
                    <div className="form-field" style={{ gridColumn: "1 / -1" }}><label htmlFor="additional-note">Additional note</label><textarea id="additional-note" rows={3} value={form.additional_note} onChange={(event) => setForm({ ...form, additional_note: event.target.value })} /></div>
                  </div>
                  <div className="form-footer">
                    <button className="system-button" type="submit" disabled={submitting || loading}>{submitting ? "Submitting…" : "Submit application"} <ArrowRight size={16} /></button>
                    <button className="admin-apply-text-button" type="button" onClick={() => navigate("/admin")}>Back to Admin Portal</button>
                  </div>
                </form>
              </section>

              <section className="tracking-card">
                <div className="application-status-heading"><div><div className="micro-label">YOUR SUBMISSIONS</div><h2><ClipboardList size={19} /> Application status</h2></div><button className="admin-apply-text-button" type="button" onClick={() => void loadApplications(user)} disabled={loading}>{loading ? "Refreshing…" : "Refresh status"}</button></div>
                {loading ? <p className="success-description">Loading your applications…</p>
                : applications.length === 0 ? <p className="success-description">No applications yet. Your submission will appear here after the server confirms it.</p>
                : applications.map((application) => <article className="application-status-card" key={application.id}>
                  <div className="application-status-heading"><div><strong>{application.full_name}</strong><div className="application-date">Submitted {new Date(application.created_at).toLocaleDateString("en-IN")}</div></div><span className={`application-status-pill status-${application.status.toLowerCase()}`}>{statusLabel(application.status)}</span></div>
                  <p className="status-description">Enrollment: {application.enrollment_number}</p>
                  {application.rejection_reason && <p className="rejection-reason">{application.rejection_reason}</p>}
                  {application.status === "ACCEPTED" && <div className="accepted-notice">Your application has been accepted. Follow the registration instructions provided by the administrator team.</div>}
                </article>)}
              </section>
            </>
          )}

          <footer className="form-footer"><span>Gradly Ecosystem · Authorized access only</span>{user && <button className="admin-apply-text-button" type="button" onClick={() => void signOutUser()}>Sign out</button>}</footer>
        </div>
      </main>
    </div>
  );
}
