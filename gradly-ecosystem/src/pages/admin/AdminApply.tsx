import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { auth, signInWithGoogle } from "../../config/firebase";
import "./AdminApply.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");

type Branch = { id: string; name: string; code?: string | null; program_id: string; program_name: string; program_level?: string | null };
type Institution = { id: string; name: string; branches: Branch[] };
type Application = { id: string; status: string; created_at?: string; institution_name?: string; program_name?: string; branch_name?: string; rejection_reason?: string | null };

const statusLabel = (status: string) => status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export default function AdminApply() {
  const [userEmail, setUserEmail] = useState(auth.currentUser?.email || "");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [programId, setProgramId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [fullName, setFullName] = useState(auth.currentUser?.displayName || "");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [qualification, setQualification] = useState("");
  const [reason, setReason] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedInstitution = institutions.find(i => i.id === institutionId);
  const programs = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; level?: string | null }>();
    for (const branch of selectedInstitution?.branches ?? []) unique.set(branch.program_id, { id: branch.program_id, name: branch.program_name, level: branch.program_level });
    return Array.from(unique.values());
  }, [selectedInstitution]);
  const selectedProgram = programs.find(p => p.id === programId);
  const branches = (selectedInstitution?.branches ?? []).filter(b => b.program_id === programId);
  const isMCA = /\bmca\b|master of computer applications/i.test(selectedProgram?.name || "");

  async function loadApplications() {
    const user = auth.currentUser;
    if (!user) { setApplications([]); return; }
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE}/admin-applications/mine`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setApplications(Array.isArray(data.applications) ? data.applications : []);
    else if (response.status !== 403) throw new Error(data.message || "Unable to load your application status.");
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [masterResponse] = await Promise.all([fetch(`${API_BASE}/academic/institutions`)]);
        const masterData = await masterResponse.json().catch(() => ({}));
        if (!masterResponse.ok) throw new Error(masterData.message || "Unable to load institutions and branches.");
        if (active) setInstitutions(Array.isArray(masterData.data) ? masterData.data : []);
        if (auth.currentUser) {
          if (active) { setUserEmail(auth.currentUser.email || ""); setFullName(auth.currentUser.displayName || ""); }
          await loadApplications();
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Unable to load application data."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  async function handleGoogleSignIn() {
    setBusy(true); setError(""); setNotice("");
    try {
      const user = await signInWithGoogle();
      const token = await user.getIdToken();
      const syncResponse = await fetch(`${API_BASE.replace(/\/api$/i, "")}/api/auth/sync`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const syncData = await syncResponse.json().catch(() => ({}));
      if (!syncResponse.ok) throw new Error(syncData.message || "Could not synchronize your Google account with Gradly.");
      setUserEmail(user.email || "");
      setFullName(user.displayName || "");
      await loadApplications();
      setNotice("Google account verified. Complete the form to submit your application.");
    } catch (e) { setError(e instanceof Error ? e.message : "Google sign-in failed."); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in with Google before applying.");
      if (!institutionId || !programId || (!isMCA && !branchId)) throw new Error("Choose your institution, program and branch.");
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE}/admin-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          institution_id: institutionId, program_id: programId, branch_id: isMCA ? "" : branchId,
          full_name: fullName.trim(), enrollment_number: enrollmentNumber.trim(), mobile_number: mobileNumber.trim(),
          graduation_date: graduationDate, qualification: qualification.trim(), reason: reason.trim(), additional_note: additionalNote.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Application submission failed.");
      setNotice(data.message || "Your application has been submitted for review.");
      await loadApplications();
    } catch (e) { setError(e instanceof Error ? e.message : "Application submission failed."); }
    finally { setBusy(false); }
  }

  return <main className="admin-apply-page" style={{minHeight:"100vh",background:"#f2f8f3",color:"#183d2b",padding:"24px 16px 56px",fontFamily:'Inter,"Segoe UI",Arial,sans-serif'}}>
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <Link to="/admin" style={{display:"inline-flex",alignItems:"center",gap:8,color:"#216a41",textDecoration:"none",fontWeight:700,fontSize:13}}><ArrowLeft size={16}/> Back to Admin Portal</Link>
      <header style={{display:"flex",gap:16,alignItems:"center",margin:"28px 0"}}>
        <div style={{width:54,height:54,borderRadius:16,background:"#17683e",color:"#fff",display:"grid",placeItems:"center"}}><ShieldCheck size={27}/></div>
        <div><p style={{fontSize:10,letterSpacing:2,fontWeight:850,color:"#25804d",margin:"0 0 6px"}}>GRADLY ECOSYSTEM · ADMIN ONBOARDING</p><h1 style={{fontSize:"clamp(28px,4vw,40px)",margin:0}}>Apply for Admin access</h1><p style={{color:"#627969",margin:"8px 0 0"}}>One application per Firebase account. Access is granted only after Super Admin review.</p></div>
      </header>
      {error && <div role="alert" style={{padding:14,borderRadius:10,background:"#fff0ef",color:"#9d3028",marginBottom:16}}>{error}</div>}
      {notice && <div role="status" style={{padding:14,borderRadius:10,background:"#e8f8ed",color:"#17683e",marginBottom:16}}>{notice}</div>}
      {loading ? <p>Loading application details…</p> : <>
        <section style={{background:"#fff",border:"1px solid #d6e6da",borderRadius:18,padding:24,boxShadow:"0 12px 34px #1c593010",marginBottom:20}}>
          <h2 style={{fontSize:19,marginTop:0}}>1. Verify your account</h2>
          <p style={{color:"#6a7e70",fontSize:14}}>Sign in with the Google account you want linked to your single Admin application.</p>
          <button type="button" onClick={handleGoogleSignIn} disabled={busy} style={{padding:"12px 16px",borderRadius:10,border:"1px solid #bfd9c6",background:"#f7fcf8",color:"#20583a",fontWeight:800,cursor:"pointer"}}>{busy ? "Please wait…" : userEmail ? `Signed in: ${userEmail} · Verify / switch account` : "Continue with Google"}</button>
          {applications.length > 0 && <div style={{marginTop:18,borderTop:"1px solid #e4eee6",paddingTop:16}}><h3 style={{fontSize:15}}>Your application record</h3>{applications.map(app => <div key={app.id} style={{padding:14,border:"1px solid #dce9df",borderRadius:10,marginTop:8}}><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><strong>{app.institution_name || "Admin application"}{app.program_name ? ` · ${app.program_name}` : ""}</strong><span style={{fontSize:11,fontWeight:800,color:"#17683e",background:"#e8f8ed",padding:"5px 8px",borderRadius:99}}>{statusLabel(app.status)}</span></div>{app.rejection_reason && <p style={{color:"#9d3028"}}>Review note: {app.rejection_reason}</p>}</div>)}<p style={{fontSize:13,color:"#6a7e70"}}>This account has already applied. A second application is not permitted.</p></div>}
        </section>
        <section style={{background:"#fff",border:"1px solid #d6e6da",borderRadius:18,padding:24,boxShadow:"0 12px 34px #1c593010"}}>
          <h2 style={{fontSize:19,marginTop:0}}>2. Application details</h2>
          {applications.length > 0 ? <p style={{color:"#627969"}}>Your account has an existing application, so this form is locked.</p> : <form onSubmit={submit} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14}}>
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750}}>Full name<input required value={fullName} onChange={e=>setFullName(e.target.value)} style={fieldStyle} placeholder="Your full name"/></label>
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750}}>Email<input value={userEmail} readOnly style={{...fieldStyle,background:"#f3f7f4"}} placeholder="Verified Google email"/></label>
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750}}>Institution<select required value={institutionId} onChange={e=>{setInstitutionId(e.target.value);setProgramId("");setBranchId("");}} style={fieldStyle}><option value="">Choose institution</option>{institutions.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750}}>Program<select required value={programId} onChange={e=>{setProgramId(e.target.value);setBranchId("");}} style={fieldStyle} disabled={!institutionId}><option value="">Choose program</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}{p.level ? ` · ${p.level}` : ""}</option>)}</select></label>
            {!isMCA && <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750}}>Branch / department<select required value={branchId} onChange={e=>setBranchId(e.target.value)} style={fieldStyle} disabled={!programId}><option value="">Choose branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ""}</option>)}</select></label>}
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750}}>Enrollment number<input required value={enrollmentNumber} onChange={e=>setEnrollmentNumber(e.target.value)} style={fieldStyle} placeholder="College enrollment number"/></label>
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750}}>Mobile number<input required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} value={mobileNumber} onChange={e=>setMobileNumber(e.target.value)} style={fieldStyle} placeholder="10-digit Indian number"/></label>
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750}}>Expected graduation date<input required type="date" min={new Date().toISOString().slice(0,10)} value={graduationDate} onChange={e=>setGraduationDate(e.target.value)} style={fieldStyle}/></label>
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750}}>Qualification<input value={qualification} onChange={e=>setQualification(e.target.value)} style={fieldStyle} placeholder="e.g. B.Tech IT"/></label>
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750,gridColumn:"1 / -1"}}>Why are you applying? <textarea required value={reason} onChange={e=>setReason(e.target.value)} style={{...fieldStyle,minHeight:88,resize:"vertical"}} placeholder="Describe your role, relevant experience and responsibilities you can take on."/></label>
            <label style={{display:"grid",gap:7,fontSize:12,fontWeight:750,gridColumn:"1 / -1"}}>Additional note (optional)<textarea value={additionalNote} onChange={e=>setAdditionalNote(e.target.value)} style={{...fieldStyle,minHeight:70,resize:"vertical"}} placeholder="Any extra information for the reviewer."/></label>
            <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"flex-start",gap:9,background:"#f1faf3",border:"1px solid #d6ecdc",padding:12,borderRadius:10,color:"#527260",fontSize:12,lineHeight:1.6}}><Clock3 size={17} style={{flexShrink:0,marginTop:2}}/>Your application will remain pending until reviewed. Submitting does not grant Admin access automatically.</div>
            <button type="submit" disabled={busy || !auth.currentUser} style={{gridColumn:"1 / -1",border:0,borderRadius:10,padding:14,background:"#17683e",color:"#fff",fontWeight:850,cursor:busy?"wait":"pointer"}}>{busy ? "Submitting application…" : "Submit Admin application"}</button>
          </form>}
        </section>
      </>}
      <footer style={{display:"flex",gap:8,alignItems:"center",justifyContent:"center",color:"#819487",fontSize:11,marginTop:24}}><FileCheck2 size={14}/> <CheckCircle2 size={14}/> Gradly · Applications are reviewed by Super Admin</footer>
    </div>
  </main>;
}

const fieldStyle: React.CSSProperties = { width:"100%", boxSizing:"border-box", padding:"12px 13px", border:"1px solid #d4e2d7", borderRadius:9, background:"#fcfefc", color:"#173b2b", font:"inherit", outlineColor:"#36a467" };
