import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./CommunitiesPanel.css";

const API = import.meta.env.VITE_COMMUNITIES_API_URL || "https://gradly-communities-api.jugalpkhr.workers.dev";
const TOKEN_KEY = "gradly_communities_session";

export default function CommunitiesVerifyPage() {
  const started = useRef(false);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email address…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("token");
    const loginToken = params.get("loginToken");
    const inviteToken = params.get("inviteToken");
    const pendingInvite = inviteToken || localStorage.getItem("gradly_communities_pending_invite");
    if (inviteToken) localStorage.setItem("gradly_communities_pending_invite", inviteToken);

    const acceptInvite = async (sessionToken: string, token: string) => {
      const response = await fetch(API + "/groups/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": "Bearer " + sessionToken },
        body: JSON.stringify({ token })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.error || "Unable to accept this group invitation.");
      localStorage.removeItem("gradly_communities_pending_invite");
      return data.group?.name as string | undefined;
    };

    if (!verifyToken && !loginToken) {
      if (!pendingInvite) {
        setState("error");
        setMessage("This link is incomplete. Please open the latest email from Gradly Communities.");
        return;
      }
      const existingSession = localStorage.getItem(TOKEN_KEY);
      if (existingSession) {
        acceptInvite(existingSession, pendingInvite).then((groupName) => {
          setState("success");
          setMessage("You joined " + (groupName || "the group") + ". Continue to Gradly to open Communities.");
        }).catch((error) => {
          setState("error");
          setMessage(error instanceof Error ? error.message : "Unable to accept invitation.");
        });
      } else {
        setState("success");
        setMessage("Invitation saved. Sign in to Gradly, then sign in to Communities using the invited email address to accept it.");
      }
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    const endpoint = loginToken ? "/auth/login/verify" : "/auth/verify";
    const token = loginToken || verifyToken;
    fetch(API + endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token })
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.error || "This link is invalid or expired.");
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        if (pendingInvite) {
          const groupName = await acceptInvite(data.token, pendingInvite);
          setMessage("You are signed in and joined " + (groupName || "the invited group") + ". Continue to Gradly.");
        } else {
          setMessage(loginToken ? "You are signed in to Gradly Communities. Continue to Gradly and open Communities." : "Your email is verified and you are signed in to Gradly Communities. Continue to Gradly.");
        }
      }
      setState("success");
    }).catch((error) => {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Verification could not be completed.");
    });
    window.history.replaceState({}, "", window.location.pathname);
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
