import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Fingerprint, KeyRound, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { API_BASE_URL, setToken, verifySession } from "../../lib/superAdminSession";
import "./SuperAdminLogin.css";

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/super-admin";
  const [checking, setChecking] = useState(true);
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    verifySession().then((status) => {
      if (cancelled) return;
      if (status === "valid") navigate(from, { replace: true });
      else setChecking(false);
    }).catch(() => {
      if (!cancelled) setChecking(false);
    });
    return () => { cancelled = true; };
  }, [navigate, from]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/super-admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ adminCode: adminCode.trim(), password }),
      });
      const result = await response.json().catch(() => null);
      const token: unknown = result?.token ?? result?.accessToken;
      if (!response.ok || typeof token !== "string") {
        setError(response.status === 429
          ? "Too many attempts. Please wait a little before trying again."
          : result?.message ?? "We couldn't verify those credentials. Check them and try again.");
        return;
      }
      setToken(token);
      setPassword("");
      navigate(from, { replace: true });
    } catch {
      setError("Unable to connect to Gradly securely. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <main className="sa-login-loading"><span className="sa-login-spinner" /><p>Verifying your secure session…</p></main>;
  }

  return (
    <main className="sa-login-page">
      <div className="sa-login-glow sa-login-glow-one" aria-hidden="true" />
      <div className="sa-login-glow sa-login-glow-two" aria-hidden="true" />
      <header className="sa-login-topbar">
        <div className="sa-login-brand">
          <span className="sa-login-brand-mark">G</span>
          <span className="sa-login-brand-copy"><strong>GRADLY</strong><small>ECOSYSTEM</small></span>
        </div>
        <div className="sa-login-topbar-note"><span className="sa-login-live-dot" /> SECURE ADMINISTRATIVE ACCESS</div>
      </header>

      <section className="sa-login-layout">
        <div className="sa-login-intro">
          <span className="sa-login-overline"><Sparkles size={14} /> THE CONTROL CENTRE</span>
          <h1>Lead with clarity.<br /><span>Manage with confidence.</span></h1>
          <p>One secure workspace for platform governance, academic operations, institutional access, and ecosystem activity.</p>
          <div className="sa-login-trust-list">
            <div><span className="sa-login-trust-icon"><ShieldCheck size={18} /></span><span><strong>Protected access</strong><small>Restricted to authorised Super Admins</small></span></div>
            <div><span className="sa-login-trust-icon"><Fingerprint size={18} /></span><span><strong>Account-level control</strong><small>Manage your ecosystem from one place</small></span></div>
          </div>
          <div className="sa-login-decoration" aria-hidden="true"><div className="sa-login-decoration-orbit orbit-a" /><div className="sa-login-decoration-orbit orbit-b" /><div className="sa-login-decoration-core"><ShieldCheck size={37} /></div></div>
        </div>

        <form className="sa-login-card" onSubmit={handleSubmit}>
          <div className="sa-login-card-head">
            <span className="sa-login-card-icon"><LockKeyhole size={22} /></span>
            <span className="sa-login-card-kicker">SUPER ADMINISTRATOR</span>
            <h2>Welcome back</h2>
            <p>Sign in to continue to your secure workspace.</p>
          </div>

          <div className="sa-login-field">
            <label htmlFor="sa-admin-code">ADMIN CODE</label>
            <div className="sa-login-input-wrap"><Fingerprint size={17} aria-hidden="true" /><input id="sa-admin-code" type="text" placeholder="Enter your admin code" autoComplete="username" autoCapitalize="none" spellCheck={false} value={adminCode} onChange={(e) => setAdminCode(e.target.value)} required disabled={submitting} /></div>
          </div>

          <div className="sa-login-field">
            <div className="sa-login-label-row"><label htmlFor="sa-password">PASSWORD</label><span><LockKeyhole size={12} /> Encrypted connection</span></div>
            <div className="sa-login-input-wrap"><KeyRound size={17} aria-hidden="true" /><input id="sa-password" type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={submitting} /><button className="sa-login-password-toggle" type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} disabled={submitting}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          </div>

          {error && <div className="sa-login-error" role="alert"><span>!</span><p>{error}</p></div>}

          <button className="sa-login-submit" type="submit" disabled={submitting || !adminCode.trim() || !password}>{submitting ? <><span className="sa-login-spinner" /> Verifying credentials…</> : <>Sign in securely <ArrowRight size={17} /></>}</button>
          <div className="sa-login-card-security"><ShieldCheck size={15} /><span>Your session is protected by Gradly's authentication system.</span></div>
        </form>
      </section>

      <footer className="sa-login-footer"><span>© {new Date().getFullYear()} GRADLY ECOSYSTEM</span><span><span className="sa-login-footer-dot" /> PRIVATE ADMIN WORKSPACE</span><span>AUTHORISED ACCESS ONLY</span></footer>
    </main>
  );
}
