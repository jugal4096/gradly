import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./CommunitiesPanel.css";

const API = import.meta.env.VITE_COMMUNITIES_API_URL || "https://gradly-communities-api.jugalpkhr.workers.dev";

export default function CommunitiesVerifyPage() {
  const started = useRef(false);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email address…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      setMessage("This verification link is incomplete. Please open the latest email from Gradly Communities.");
      return;
    }
    fetch(API + "/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token })
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.error || "This verification link is invalid or expired.");
      setState("success");
      setMessage("Your email address is verified. You can now open Gradly and sign in to your Communities account.");
    }).catch((error) => {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Verification could not be completed.");
    });
  }, []);

  return <main className="gc-shell gc-verify-page"><section className="gc-auth-card">
    <div className="gc-brand-mark">G</div>
    <span className="gc-eyebrow">GRADLY · COMMUNITIES</span>
    <h2>{state === "success" ? "Email verified" : state === "error" ? "Verification issue" : "Verifying your email"}</h2>
    <p className="gc-muted">{message}</p>
    {state === "loading" && <div className="gc-verify-spinner" aria-label="Loading"/>}
    {state === "success" && <Link className="gc-primary gc-verify-link" to="/">Continue to Gradly →</Link>}
    {state === "error" && <Link className="gc-primary gc-verify-link" to="/">Return to Gradly →</Link>}
  </section></main>;
}
