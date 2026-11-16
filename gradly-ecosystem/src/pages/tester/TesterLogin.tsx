import { useState, type FormEvent } from "react";
import { ArrowLeft, FlaskConical, LockKeyhole } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../lib/superAdminSession";
import "./Tester.css";

const API = API_BASE_URL.replace(/\/+$/, "");

export default function TesterLogin() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(API + "/api/tester/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: loginId.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.message || "Unable to sign in.");
      sessionStorage.setItem("gradly_tester_access_token", data.token);
      sessionStorage.setItem("gradly_tester_login_id", data.tester?.loginId || loginId.trim());
      navigate("/tester/workspace", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to connect to Gradly.");
    } finally { setBusy(false); }
  }

  return <main className="tester-auth-page">
    <header><Link to="/"><ArrowLeft size={16}/> Gradly Ecosystem</Link><span><i/> SECURE TESTER ACCESS</span></header>
    <section className="tester-auth-panel">
      <div className="tester-auth-mark"><FlaskConical size={25}/></div>
      <span className="tester-auth-kicker">ISOLATED STUDENT ENVIRONMENT</span>
      <h1>Continue as Tester</h1>
      <p>Sign in with the tester ID and password already assigned to you by the Super Admin.</p>
      <form onSubmit={submit}>
        <label htmlFor="tester-login-id">TESTER ID</label>
        <input id="tester-login-id" autoComplete="username" value={loginId} onChange={event=>setLoginId(event.target.value)} required/>
        <label htmlFor="tester-login-password">PASSWORD</label>
        <div className="tester-password-wrap"><LockKeyhole size={16}/><input id="tester-login-password" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/></div>
        {error && <div className="tester-login-error" role="alert">{error}</div>}
        <button disabled={busy}>{busy ? "VERIFYING…" : "OPEN VIRTUAL TEST WORKSPACE"}</button>
      </form>
      <small>After tester sign-in, you will enter an isolated virtual student environment. No Gradly student login is required.</small>
    </section>
  </main>;
}
