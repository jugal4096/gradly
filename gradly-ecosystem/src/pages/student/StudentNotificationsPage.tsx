import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bell, CheckCheck, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { auth } from "../../config/firebase";

type StudentNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

const API_ROOT = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in to view your notifications.");
      const token = await user.getIdToken();
      const response = await fetch(API_ROOT + "/auth/notifications", { headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load notifications.");
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markRead(item: StudentNotification) {
    if (item.readAt) return;
    setBusyId(item.id);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in to update notifications.");
      const token = await user.getIdToken();
      const response = await fetch(API_ROOT + "/auth/notifications/" + encodeURIComponent(item.id) + "/read", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to mark notification as read.");
      setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, readAt: data.notification?.readAt || new Date().toISOString() } : notification));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update notification.");
    } finally {
      setBusyId(null);
    }
  }

  const unread = notifications.filter((item) => !item.readAt).length;

  return <main style={{ minHeight: "100vh", padding: "clamp(20px,5vw,56px)", background: "var(--page-bg,#f5f8f5)", color: "var(--text,#20382b)" }}>
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none", marginBottom: 24 }}><ArrowLeft size={16}/> Back to Gradly</Link>
      <section style={{ background: "#fff", border: "1px solid #e2ebe4", borderRadius: 20, padding: "clamp(20px,4vw,36px)", boxShadow: "0 16px 45px #173b2510" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 46, height: 46, borderRadius: 14, display: "grid", placeItems: "center", background: "#e0f5e8", color: "#124333" }}><Bell size={22}/></span>
            <div><p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: "#19744f" }}>GRADLY / INBOX</p><h1 style={{ margin: "4px 0 0", fontSize: 28 }}>Notifications</h1><p style={{ margin: "5px 0 0", color: "#64756a", fontSize: 12 }}>{unread} unread · {notifications.length} total</p></div>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 12px", border: "1px solid #dce8df", borderRadius: 9, background: "#fff", color: "#24543c", cursor: loading ? "wait" : "pointer" }}><RefreshCw size={15}/> Refresh</button>
        </header>
        {error && <p role="alert" style={{ display: "flex", gap: 8, alignItems: "center", padding: 12, borderRadius: 10, background: "#fff0ee", color: "#a12d22", fontSize: 13 }}><CircleAlert size={17}/>{error}</p>}
        {loading ? <p style={{ padding: 36, textAlign: "center", color: "#718076" }}>Loading your notifications…</p> : notifications.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#718076" }}><Bell size={28}/><h2 style={{ color: "#294234", fontSize: 17 }}>You're all caught up</h2><p style={{ fontSize: 13 }}>Messages from Gradly Super Admin will appear here.</p></div> : <div style={{ display: "grid", gap: 10 }}>
          {notifications.map((item) => <article key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, padding: 16, border: "1px solid " + (item.readAt ? "#e6eee8" : "#b9dec6"), borderRadius: 13, background: item.readAt ? "#fff" : "#f5fbf6" }}>
            <div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .7, color: "#28724b" }}>{item.type.replace(/_/g, " ")}</span>{!item.readAt && <span style={{ padding: "3px 7px", borderRadius: 99, background: "#e0f5e8", color: "#17623a", fontSize: 9, fontWeight: 800 }}>NEW</span>}<time style={{ color: "#8a978e", fontSize: 10 }}>{formatDate(item.createdAt)}</time></div><h2 style={{ margin: "0 0 7px", fontSize: 15, color: "#243b2e" }}>{item.title}</h2><p style={{ margin: 0, color: "#64756a", fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{item.message}</p>{item.actionUrl && <Link to={item.actionUrl} style={{ display: "inline-block", marginTop: 10, color: "#17623a", fontSize: 12, fontWeight: 700 }}>Open related section →</Link>}</div>
            <div>{item.readAt ? <span title="Read" style={{ color: "#5b9871" }}><CheckCheck size={18}/></span> : <button type="button" onClick={() => void markRead(item)} disabled={busyId === item.id} style={{ padding: "7px 9px", border: "1px solid #cfe4d5", borderRadius: 8, background: "#fff", color: "#286545", fontSize: 10, cursor: "pointer" }}>{busyId === item.id ? "…" : "Mark read"}</button>}</div>
          </article>)}
        </div>}
        <p style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "20px 0 0", color: "#87958b", fontSize: 11, lineHeight: 1.6 }}><ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }}/> Notifications are private to your Gradly account.</p>
      </section>
    </div>
  </main>;
}
