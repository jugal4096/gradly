import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, BarChart3, FlaskConical, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { API_BASE_URL } from "../../lib/superAdminSession";
import "./Tester.css";

const API = API_BASE_URL.replace(/\\/+$/, "");

export default function TesterModeSelect() {
  const navigate = useNavigate();
  const [testerId, setTesterId] = useState("Tester");
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("gradly_tester_access_token") || sessionStorage.getItem("gradly_tester_access_token") || "";
    if (!token) { navigate("/tester/login", { replace: true }); return; }
    let active = true;
    fetch(API + "/api/tester/me", { headers: { Authorization: "Bearer " + token } })
      .then(async response => {
        if (!response.ok) throw new Error("Your tester session is invalid or inactive. Please sign in again.");
        return response.json();
      })
      .then(data => {
        if (!active) return;
        const id = data.tester?.loginId || "Tester";
        setTesterId(id);
        localStorage.setItem("gradly_tester_login_id", id);
        sessionStorage.setItem("gradly_tester_login_id", id);
      })
      .catch(reason => {
        if (!active) return;
        localStorage.removeItem("gradly_tester_access_token");
        sessionStorage.removeItem("gradly_tester_access_token");
        setError(reason instanceof Error ? reason.message : "Unable to verify tester access.");
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [navigate]);

  function signOut() {
    localStorage.removeItem("gradly_tester_access_token");
    sessionStorage.removeItem("gradly_tester_access_token");
    localStorage.removeItem("gradly_tester_login_id");
    sessionStorage.removeItem("gradly_tester_login_id");
    navigate("/tester/login", { replace: true });
  }

  if (checking) return <main className="tester-mode-page"><div className="tester-mode-loading"><span className="tester-mode-spinner"/><strong>Verifying tester workspace…</strong></div></main>;

  return <main className="tester-mode-page">
    <header className="tester-mode-header">
      <a className="tester-mode-brand" href="/"><span className="tester-mode-brand-mark">G</span><span>Gradly <small>ECOSYSTEM TEST LAB</small></span></a>
      <div className="tester-mode-account"><span><i/> TESTER · {testerId}</span><button type="button" onClick={signOut}>Sign out</button></div>
    </header>
    <section className="tester-mode-main">
      <div className="tester-mode-intro">
        <span className="tester-mode-eyebrow"><ShieldCheck size={14}/> ISOLATED TEST ENVIRONMENT</span>
        <h1>Choose how you want to test.</h1>
        <p>Run Gradly as one student with the familiar virtual workspace, or audit an entire batch of academic records with Ultra Testing.</p>
      </div>
      {error && <div className="tester-mode-error" role="alert">{error} <button type="button" onClick={() => navigate("/tester/login")}>Sign in again</button></div>}
      <div className="tester-mode-grid">
        <button type="button" className="tester-mode-card tester-mode-user" onClick={() => navigate("/tester/workspace")}>
          <div className="tester-mode-card-top"><span className="tester-mode-icon"><GraduationCap size={25}/></span><span className="tester-mode-index">01 / USER TESTING</span></div>
          <div className="tester-mode-card-copy"><span className="tester-mode-label">INDIVIDUAL STUDENT SIMULATION</span><h2>User Testing</h2><p>Open the existing virtual student experience. Test academic setup, subject selection, SGPA/CGPA tools and student-facing features exactly as before.</p></div>
          <div className="tester-mode-card-footer"><span>Continue with the existing tester workspace</span><ArrowRight size={19}/></div>
        </button>
        <button type="button" className="tester-mode-card tester-mode-ultra" onClick={() => navigate("/tester/ultra")}>
          <div className="tester-mode-card-top"><span className="tester-mode-icon"><FlaskConical size={25}/></span><span className="tester-mode-index">02 / BULK ACADEMIC QA</span></div>
          <div className="tester-mode-card-copy"><span className="tester-mode-label">UP TO 100 ENROLLMENTS PER BATCH</span><h2>Ultra Testing</h2><p>Audit multiple enrollments, inspect semester results, compare SGPA/CGPA, discover new subjects and identify issues across and within branches.</p></div>
          <div className="tester-mode-highlights"><span><Users size={14}/> Bulk audit</span><span><BarChart3 size={14}/> Academic analytics</span><span><Activity size={14}/> Issue explorer</span></div>
          <div className="tester-mode-card-footer"><span>Open the academic audit workspace</span><ArrowRight size={19}/></div>
        </button>
      </div>
      <p className="tester-mode-footnote">Both environments are isolated from real student accounts and saved academic records.</p>
    </section>
  </main>;
}
