import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LogOut,
  RefreshCw,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { auth, signInWithGoogle, signOutUser } from "../../config/firebase";
import "./AdminApply.css";

const configuredApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api"
).trim().replace(/\/+$/, "");
const API_ROOT = /\/api$/i.test(configuredApiBaseUrl)
  ? configuredApiBaseUrl
  : `${configuredApiBaseUrl}/api`;

type Branch = { id: string; name: string; code?: string | null; program_id: string; program_name: string; program_level?: string | null };
type Institution = { id: string; name: string; branches: Branch[] };
type Application = {
  id: string;
  institution_id?: string;
  program_id?: string;
  program_name?: string | null;
  branch_id?: string;
  branch_name?: string | null;
  full_name?: string;
  enrollment_number?: string;
  mobile_number?: string;
  email?: string;
  graduation_date?: string;
  qualification?: string | null;
  requested_role?: string;
  reason?: string | null;
  additional_note?: string | null;
  status: string;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
};

type PasswordRequest = { id: string; admin_code: string; admin_email: string; status: string; created_at?: string; reviewed_at?: string | null; review_note?: string | null; completed_at?: string | null };

type ApplicationForm = {
  institution_id: string;
  program_id: string;
  branch_id: string;
  specialization_code: string;
  full_name: string;
  enrollment_number: string;
  mobile_number: string;
  graduation_date: string;
  qualification: string;
  reason: string;
  additional_note: string;
};

const emptyForm: ApplicationForm = {
  institution_id: "",
  program_id: "",
  branch_id: "",
  specialization_code: "",
  full_name: "",
  enrollment_number: "",
  mobile_number: "",
  graduation_date: "",
  qualification: "B.Tech",
  reason: "",
  additional_note: "",
};

function humanizeStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AdminApply() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [passwordRequests, setPasswordRequests] = useState<PasswordRequest[]>([]);
  const [passwordRequestLoading, setPasswordRequestLoading] = useState(false);
  const [passwordRequestSubmitting, setPasswordRequestSubmitting] = useState(false);
  const [resettingRequestId, setResettingRequestId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const selectedInstitution = useMemo(
    () => institutions.find((institution) => institution.id === form.institution_id),
    [institutions, form.institution_id]
  );
  const availablePrograms = useMemo(() => {
    const uniquePrograms = new Map<string, { id: string; name: string; level?: string | null }>();
    (selectedInstitution?.branches ?? []).forEach((branch) => uniquePrograms.set(branch.program_id, { id: branch.program_id, name: branch.program_name, level: branch.program_level }));
    return Array.from(uniquePrograms.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedInstitution]);
  const selectedProgram = availablePrograms.find((program) => program.id === form.program_id);
  const normalizedProgramName = (selectedProgram?.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const isMCA =
    normalizedProgramName === "mca" ||
    normalizedProgramName.includes("master of computer applications");
  const isMTech =
    normalizedProgramName.includes("m.tech") ||
    normalizedProgramName.includes("m tech") ||
    normalizedProgramName.includes("master of technology");
  // Branches are taken only from the selected program's actual institution records.
  // MCA is program-level and deliberately has no branch selection.
  const availableBranches = isMCA
    ? []
    : (selectedInstitution?.branches ?? []).filter((branch) => {
        if (branch.program_id !== form.program_id) return false;
        const name = branch.name.trim().toLowerCase().replace(/[_-]+/g, " ");
        const code = (branch.code ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
        // MCA is a program, never a branch. Exclude legacy/mislabelled records.
        if (name === "mca" || name === "master of computer applications" ||
            code === "mca") return false;
        return true;
      });
  const selectedBranch = availableBranches.find((branch) => branch.id === form.branch_id);
  const availableStreams = useMemo(() => {
    if (!isMTech || !selectedBranch) return [];
    const normalize = (value: string) => value.trim().toLowerCase()
      .replace(/[_-]+/g, " ").replace(/\bengineering\b/g, "")
      .replace(/\s+/g, " ").trim();
    const branchName = normalize(selectedBranch.name);
    const branchCode = normalize(selectedBranch.code ?? "");
    const isCivil = branchName.includes("civil") || branchCode.includes("civil") ||
      branchCode === "ce";
    const isAppliedMechanics =
      branchName.includes("applied mechanics") || branchCode.includes("applied mechanics") ||
      branchCode === "am" || branchCode === "applied mech";
    const isElectrical =
      branchName.includes("electrical") || branchCode.includes("electrical") ||
      branchCode === "ee" || branchCode === "elect";
    if (isCivil) return [
      { code: "WRE", name: "Water Resources Engineering" },
      { code: "GTE", name: "Geotechnical Engineering" },
    ];
    if (isAppliedMechanics) return [
      { code: "STRUCTURAL", name: "Structural Engineering" },
    ];
    if (isElectrical) return [
      { code: "EPS", name: "Electrical Power Systems" },
    ];
    return [];
  }, [isMTech, selectedBranch]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const loadInstitutions = useCallback(async () => {
    setLoadingInstitutions(true);
    try {
      const response = await fetch(`${API_ROOT}/academic/institutions`, {
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Could not load institutions and branches.");
      }
      const rows = result.data ?? result.institutions ?? [];
      setInstitutions(Array.isArray(rows) ? rows : []);
    } catch (caught) {
      setError(messageFrom(caught, "Could not load institutions and branches."));
    } finally {
      setLoadingInstitutions(false);
    }
  }, []);

  const loadApplications = useCallback(async (currentUser: User, quiet = false) => {
    if (!quiet) setLoadingApplications(true);
    try {
      const idToken = await currentUser.getIdToken();
      const authHeaders = {
        Accept: "application/json",
        Authorization: `Bearer ${idToken}`,
      };

      // Ensure a first-time Google applicant has a Gradly user record before
      // submitting or tracking an application.
      const syncResponse = await fetch(`${API_ROOT}/auth/sync`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
      });
      const syncResult = await syncResponse.json().catch(() => ({}));
      if (!syncResponse.ok) {
        throw new Error(syncResult.message || "Could not prepare your Gradly account.");
      }

      const response = await fetch(`${API_ROOT}/admin-applications/mine`, {
        headers: authHeaders,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Could not load your application history.");
      }
      setApplications(Array.isArray(result.applications) ? result.applications : []);
    } catch (caught) {
      setError(messageFrom(caught, "Could not load your application history."));
    } finally {
      setLoadingApplications(false);
    }
  }, []);

  useEffect(() => {
    void loadInstitutions();
  }, [loadInstitutions]);

  useEffect(() => {
    if (user) {
      void loadApplications(user);
    } else {
      setApplications([]);
    }
  }, [user, loadApplications]);

  const loadPasswordRequests = useCallback(async (currentUser: User) => {
    setPasswordRequestLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_ROOT}/admin-password-requests/mine`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(result.message || "Could not load password requests.");
      setPasswordRequests(Array.isArray(result.requests) ? result.requests : []);
    } catch (caught) {
      setError(messageFrom(caught, "Could not load password requests."));
    } finally {
      setPasswordRequestLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadPasswordRequests(user);
    else setPasswordRequests([]);
  }, [user, loadPasswordRequests]);

  useEffect(() => {
    if (!user || new URLSearchParams(window.location.search).get("tab") !== "password") return;
    const timer = window.setTimeout(() => {
      document.getElementById("password-change-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [user]);

  async function requestPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!user) { setError("Sign in with the Google account linked to your Admin account."); return; }
    if (!/^[A-Za-z0-9_-]{4,32}$/.test(adminCode.trim())) { setError("Enter your valid Admin ID."); return; }
    setPasswordRequestSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_ROOT}/admin-password-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ admin_code: adminCode.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(result.message || "Could not submit password-change request.");
      setNotice(result.message || "Request sent to Super Admin.");
      setAdminCode("");
      await loadPasswordRequests(user);
    } catch (caught) {
      setError(messageFrom(caught, "Could not submit password-change request."));
      if (user) await loadPasswordRequests(user);
    } finally {
      setPasswordRequestSubmitting(false);
    }
  }

  async function completePasswordChange(request: PasswordRequest) {
    setError("");
    setNotice("");
    if (!user) return;
    if (newPassword.length < 12 || newPassword.length > 128) { setError("New password must contain 12–128 characters."); return; }
    if (newPassword !== confirmNewPassword) { setError("The new passwords do not match."); return; }
    setResettingRequestId(request.id);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_ROOT}/admin-password-requests/${encodeURIComponent(request.id)}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(result.message || "Could not update password.");
      setNotice(result.message || "Password updated successfully.");
      setNewPassword("");
      setConfirmNewPassword("");
      await loadPasswordRequests(user);
    } catch (caught) {
      setError(messageFrom(caught, "Could not update password."));
    } finally {
      setResettingRequestId("");
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setNotice("");
    setSigningIn(true);
    try {
      const signedInUser = await signInWithGoogle();
      setUser(signedInUser);
      await loadApplications(signedInUser);
    } catch (caught) {
      setError(messageFrom(caught, "Google sign-in failed. Please try again."));
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    setError("");
    try {
      await signOutUser();
      setUser(null);
      setApplications([]);
      setNotice("You have signed out. Sign in with the same Google account to track your applications.");
    } catch (caught) {
      setError(messageFrom(caught, "Unable to sign out."));
    }
  }

  function updateField<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "institution_id" ? { program_id: "", branch_id: "", specialization_code: "" } : {}),
      ...(key === "program_id" ? { branch_id: "", specialization_code: "" } : {}),
      ...(key === "branch_id" ? { specialization_code: "" } : {}),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!user) {
      setError("Sign in with Google before submitting your application.");
      return;
    }
    if (!form.institution_id || !form.program_id || (!isMCA && !form.branch_id)) {
      setError(isMCA ? "Select an institution and program." : "Select an institution, program, and department.");
      return;
    }
    if (isMTech && availableStreams.length > 0 && !form.specialization_code) {
      setError("Select an M.Tech stream / specialization.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile_number.trim())) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const authHeaders = {
        Accept: "application/json",
        Authorization: `Bearer ${idToken}`,
      };
      const syncResponse = await fetch(`${API_ROOT}/auth/sync`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
      });
      const syncResult = await syncResponse.json().catch(() => ({}));
      if (!syncResponse.ok) {
        throw new Error(syncResult.message || "Could not prepare your Gradly account.");
      }

      const response = await fetch(`${API_ROOT}/admin-applications`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          full_name: form.full_name.trim(),
          enrollment_number: form.enrollment_number.trim(),
          mobile_number: form.mobile_number.trim(),
          qualification: form.qualification.trim(),
          reason: form.reason.trim(),
          additional_note: form.additional_note.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Unable to submit your application.");
      }

      setNotice(result.message || "Your application was submitted successfully.");
      setForm({ ...emptyForm, full_name: user.displayName ?? "", qualification: "B.Tech" });
      await loadApplications(user, true);
    } catch (caught) {
      setError(messageFrom(caught, "Unable to submit your application."));
    } finally {
      setSubmitting(false);
    }
  }

  const latestApplication = applications[0];
  const canRegister = (application: Application) =>
    ["ACCEPTED", "APPROVED"].includes(application.status.toUpperCase());

  return (
    <main className="admin-apply-page">
      <header className="admin-header">
        <div className="brand">
          <img className="brand-logo" src="/gradly-ecosystem-logo.png" alt="Gradly" onError={(event) => { const image = event.currentTarget; if (image.dataset.fallback === "1") { image.style.display = "none"; return; } image.dataset.fallback = "1"; image.src = "/gradly-ecosystem-logo.png"; }} />
          <div>
            <div className="brand-name">GRADLY</div>
            <div className="brand-subtitle">Institution administration</div>
          </div>
        </div>
        <span className="system-badge">ADMIN APPLICATIONS</span>
      </header>

      <div className="admin-main">
        <div className="page-container">
          <button className="admin-apply-text-button" type="button" onClick={() => navigate("/admin/login")}>
            <ArrowLeft size={16} /> Back to Admin login
          </button>

          <section className="page-intro">
            <div className="intro-system-icon"><GraduationCap size={27} /></div>
            <div className="intro-content">
              <p className="micro-label">ADMINISTRATOR ONBOARDING</p>
              <h1>Apply to become an Admin</h1>
              <p>Submit an application for your institution and branch. The Gradly Super Admin team will review it before any administrator access is granted.</p>
            </div>
          </section>

          {error && (
            <div className="system-alert" role="alert">
              <AlertCircle className="alert-icon" size={19} />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="system-alert" role="status">
              <CheckCircle2 className="alert-icon" size={19} />
              <span>{notice}</span>
            </div>
          )}

          {!authReady ? (
            <section className="auth-card"><p>Checking your sign-in session…</p></section>
          ) : !user ? (
            <section className="auth-card">
              <div className="success-symbol"><ShieldCheck size={26} /></div>
              <h2>Sign in to apply</h2>
              <p className="success-description">Use your Google account to submit your application and check its status later. Your application history is tied to this account.</p>
              <button className="google-sign-in-button" type="button" onClick={handleGoogleSignIn} disabled={signingIn}>
                <span className="google-g" aria-hidden="true">G</span>
                {signingIn ? "Signing in…" : "Continue with Google"}
              </button>
              <p className="auth-privacy-note"><ShieldCheck size={15} /> Google sign-in is used to identify your account. It does not grant Admin access by itself.</p>
            </section>
          ) : (
            <>
              <section className="tracking-card">
                <div>
                  <p className="micro-label">SIGNED IN ACCOUNT</p>
                  <h2>{user.displayName || user.email || "Gradly applicant"}</h2>
                  <p>{user.email}</p>
                </div>
                <button className="admin-apply-text-button" type="button" onClick={handleSignOut}>
                  <LogOut size={15} /> Sign out
                </button>
              </section>

              {loadingApplications ? (
                <section className="success-card"><p className="success-description">Checking whether this account has already submitted an application…</p></section>
              ) : applications.length > 0 ? (
                <section className="success-card existing-application-notice">
                  <div className="success-kicker"><ShieldCheck size={16} /> APPLICATION ALREADY SUBMITTED</div>
                  <h2>You’ve already applied</h2>
                  <p className="success-description">One Firebase account can submit only one administrator application. You cannot submit another application from this account, even if the existing application is rejected. Track its status below.</p>
                  <div className="existing-application-summary">
                    <span className={`application-status-pill status-${applications[0].status.toLowerCase()}`}>{humanizeStatus(applications[0].status)}</span>
                    <p><strong>Application ID:</strong> {applications[0].id}</p>
                    <p><strong>Submitted:</strong> {formatDate(applications[0].created_at)}</p>
                  </div>
                  <button className="admin-apply-text-button" type="button" onClick={() => void loadApplications(user)} disabled={loadingApplications}><RefreshCw size={15} /> Refresh application status</button>
                </section>
              ) : (
                <section className="success-card">
                  <div className="success-kicker"><ShieldCheck size={16} /> REQUEST ADMINISTRATOR ACCESS</div>
                  <h2>Application details</h2>
                  <p className="success-description">Fields marked with * are required. Use accurate academic and contact details so your request can be verified.</p>

                  <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                      <div className="form-field">
                        <label htmlFor="app-full-name">Full name *</label>
                        <input id="app-full-name" value={form.full_name} onChange={(event) => updateField("full_name", event.target.value)} autoComplete="name" maxLength={120} required />
                      </div>
                      <div className="form-field">
                        <label htmlFor="app-email">Google account email</label>
                        <input id="app-email" value={user.email ?? ""} readOnly aria-readonly="true" />
                      </div>
                      <div className="form-field">
                        <label htmlFor="app-institution">Institution *</label>
                        <select id="app-institution" value={form.institution_id} onChange={(event) => updateField("institution_id", event.target.value)} required disabled={loadingInstitutions}>
                          <option value="">{loadingInstitutions ? "Loading institutions…" : "Select institution"}</option>
                          {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                        </select>
                      </div>
                      <div className="form-field">
                        <label htmlFor="app-program">Program *</label>
                        <select id="app-program" value={form.program_id} onChange={(event) => updateField("program_id", event.target.value)} required disabled={!form.institution_id || availablePrograms.length === 0}>
                          <option value="">{availablePrograms.length ? "Select program" : "Select institution first"}</option>
                          {availablePrograms.map((program) => <option key={program.id} value={program.id}>{program.name}{program.level ? " · " + program.level : ""}</option>)}
                        </select>
                        <small>Choose the academic program for which you are requesting administrator access.</small>
                      </div>
                      {!isMCA && (
                        <div className="form-field">
                          <label htmlFor="app-branch">Department / Branch *</label>
                          <select id="app-branch" value={form.branch_id} onChange={(event) => updateField("branch_id", event.target.value)} required disabled={!form.program_id || availableBranches.length === 0}>
                            <option value="">{form.program_id ? (availableBranches.length ? "Select department / branch" : "No branches configured for this program") : "Select program first"}</option>
                            {availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.code ? " (" + branch.code + ")" : ""}</option>)}
                          </select>
                        </div>
                      )}
                      {isMCA && <div className="form-field"><small>Branch selection is not applicable for MCA.</small></div>}
                      {isMTech && availableStreams.length > 0 && (
                        <div className="form-field">
                          <label htmlFor="app-stream">Stream / Specialization *</label>
                          <select id="app-stream" value={form.specialization_code} onChange={(event) => updateField("specialization_code", event.target.value)} required>
                            <option value="">Select stream / specialization</option>
                            {availableStreams.map((stream) => <option key={stream.code} value={stream.code}>{stream.name} ({stream.code})</option>)}
                          </select>
                          <small>Select the M.Tech stream within the chosen department.</small>
                        </div>
                      )}
                      <div className="form-field">
                        <label htmlFor="app-enrollment">Enrollment / roll number *</label>
                        <input id="app-enrollment" value={form.enrollment_number} onChange={(event) => updateField("enrollment_number", event.target.value)} autoComplete="off" maxLength={80} required />
                      </div>
                      <div className="form-field">
                        <label htmlFor="app-mobile">Mobile number *</label>
                        <input id="app-mobile" type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number" value={form.mobile_number} onChange={(event) => updateField("mobile_number", event.target.value.replace(/\D/g, "").slice(0, 10))} autoComplete="tel" maxLength={10} required />
                      </div>
                      <div className="form-field">
                        <label htmlFor="app-qualification">Qualification</label>
                        <input id="app-qualification" value={form.qualification} onChange={(event) => updateField("qualification", event.target.value)} maxLength={100} placeholder="e.g. B.Tech, M.Tech" />
                      </div>
                      <div className="form-field">
                        <label htmlFor="app-graduation-date">Expected / actual graduation date *</label>
                        <input id="app-graduation-date" type="date" value={form.graduation_date} onChange={(event) => updateField("graduation_date", event.target.value)} min={new Date().toISOString().slice(0, 10)} required />
                      </div>
                      <div className="form-field">
                        <label htmlFor="app-reason">Why are you applying?</label>
                        <textarea id="app-reason" value={form.reason} onChange={(event) => updateField("reason", event.target.value)} rows={3} maxLength={1500} placeholder="Briefly describe your responsibilities or reason for requesting access." />
                      </div>
                      <div className="form-field">
                        <label htmlFor="app-note">Additional note</label>
                        <textarea id="app-note" value={form.additional_note} onChange={(event) => updateField("additional_note", event.target.value)} rows={3} maxLength={1500} placeholder="Anything else the review team should know (optional)." />
                      </div>
                    </div>
                    <div className="form-footer">
                      <p>Your request remains pending until reviewed. Submitting does not create an Admin account.</p>
                      <button className="system-button" type="submit" disabled={submitting || loadingInstitutions || institutions.length === 0}>
                        {submitting ? "Submitting application…" : "Submit application"}
                      </button>
                    </div>
                  </form>
                </section>
              )}
            </>
          )}

          {user && (
            <section id="password-change-panel" className="success-card password-request-panel">
              <div className="success-kicker"><KeyRound size={16} /> ACCOUNT SECURITY</div>
              <h2>Request a password change</h2>
              <p className="success-description">If you are an active Gradly administrator, submit your Admin ID. Super Admin will review the request before you can set a new password. Your Google account email must match the email registered to your Admin account.</p>
              <form onSubmit={requestPasswordChange}>
                <div className="form-grid password-request-grid">
                  <div className="form-field"><label htmlFor="password-request-admin-id">Admin ID *</label><input id="password-request-admin-id" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} minLength={4} maxLength={32} autoComplete="username" required placeholder="Enter your issued Admin ID" /></div>
                  <div className="form-field"><label>Verified Google account</label><input value={user.email ?? ""} readOnly aria-readonly="true" /></div>
                </div>
                <div className="form-footer"><p>Submitting creates a separate password-change request. It does not change your password until Super Admin approves it.</p><button className="system-button primary" type="submit" disabled={passwordRequestSubmitting}>{passwordRequestSubmitting ? "Sending request…" : "Request approval"}</button></div>
              </form>
              <div className="password-request-history">
                <div className="application-status-heading"><div><p className="micro-label">PASSWORD REQUESTS</p><h3>Request status</h3></div><button className="admin-apply-text-button" type="button" onClick={() => void loadPasswordRequests(user)} disabled={passwordRequestLoading}><RefreshCw size={15} /> {passwordRequestLoading ? "Refreshing…" : "Refresh"}</button></div>
                {passwordRequestLoading ? <p className="success-description">Loading requests…</p> : passwordRequests.length === 0 ? <p className="success-description">No password-change requests yet.</p> : passwordRequests.map((request) => (
                  <article className="application-status-card" key={request.id}>
                    <div className="application-status-heading"><span className={`application-status-pill status-${request.status.toLowerCase()}`}>{humanizeStatus(request.status)}</span><span className="application-date">Submitted {formatDate(request.created_at)}</span></div>
                    <p><strong>Admin ID:</strong> {request.admin_code}</p>
                    {request.review_note && <p className="status-description"><strong>Review note:</strong> {request.review_note}</p>}
                    {request.status === "APPROVED" && <div className="password-reset-form"><p>Approved. Set a new password below to finish the change.</p><div className="form-grid password-request-grid"><div className="form-field"><label htmlFor={`new-password-${request.id}`}>New password</label><input id={`new-password-${request.id}`} type="password" minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></div><div className="form-field"><label htmlFor={`confirm-password-${request.id}`}>Confirm new password</label><input id={`confirm-password-${request.id}`} type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} required /></div></div><button className="system-button primary" type="button" disabled={resettingRequestId === request.id} onClick={() => void completePasswordChange(request)}>{resettingRequestId === request.id ? "Updating password…" : "Set new password"}</button></div>}
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="tracking-card application-history">
            <div className="application-status-heading">
              <div>
                <p className="micro-label">APPLICATION TRACKING</p>
                <h2>Your application history</h2>
                <p>Sign in with the same Google account whenever you want to check progress.</p>
              </div>
              {user && (
                <button className="admin-apply-text-button" type="button" onClick={() => void loadApplications(user)} disabled={loadingApplications}>
                  <RefreshCw size={15} /> {loadingApplications ? "Refreshing…" : "Refresh status"}
                </button>
              )}
            </div>

            {!user ? (
              <p className="success-description">Sign in with Google to view applications submitted from your account.</p>
            ) : loadingApplications ? (
              <p className="success-description">Loading your applications…</p>
            ) : applications.length === 0 ? (
              <p className="success-description">No applications found for this Google account yet.</p>
            ) : (
              <div className="application-history-list">
                {applications.map((application) => {
                  const statusClass = application.status.toLowerCase();
                  return (
                    <article className="application-status-card" key={application.id}>
                      <div className="application-status-heading">
                        <span className={`application-status-pill status-${statusClass}`}>
                          {["PENDING", "UNDER_REVIEW"].includes(application.status.toUpperCase()) ? <Clock3 size={13} /> : <CheckCircle2 size={13} />}
                          {humanizeStatus(application.status)}
                        </span>
                        <span className="application-date">Submitted {formatDate(application.created_at)}</span>
                      </div>
                      <h3>{application.full_name || "Admin access request"}</h3>
                      <p><strong>Application ID:</strong> {application.id}</p>
                      <p><strong>Program:</strong> {application.program_name || "Not assigned"}</p><p><strong>Department:</strong> {application.branch_name || "Not assigned"}</p><p><strong>Role requested:</strong> {humanizeStatus(application.requested_role || "DEPARTMENT_ADMIN")}</p>
                      <p><strong>Graduation date:</strong> {application.graduation_date || "Not provided"}</p>
                      {application.reviewed_at && <p><strong>Reviewed:</strong> {formatDate(application.reviewed_at)}</p>}
                      {application.rejection_reason && <div className="rejection-reason"><strong>Review note</strong><p>{application.rejection_reason}</p></div>}
                      {canRegister(application) && (
                        <div className="accepted-notice">
                          <strong>Your application has been approved.</strong>
                          <p>You can now create your Admin ID and password. Administrator access is not activated until registration is completed.</p>
                          <button className="system-button" type="button" onClick={() => navigate(`/admin/register?applicationId=${encodeURIComponent(application.id)}`)}>
                            Continue to registration
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            {latestApplication && <p className="application-date">Last updated: {formatDate(latestApplication.updated_at)}</p>}
          </section>

          <p className="auth-privacy-note"><ShieldCheck size={15} /> Applications are tied to your signed-in account. Only submit details you are authorized to provide.</p>
        </div>
      </div>
    </main>
  );
}
