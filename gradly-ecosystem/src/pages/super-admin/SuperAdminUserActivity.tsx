import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";

type EventRecord = { id: string; action: string; actor_role?: string | null; actor_type?: string | null; actor_id?: string | null; entity_table?: string | null; entity_id?: string | null; created_at?: string | null; metadata?: Record<string, unknown> };

const buttonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #ded6f5", borderRadius: 10, padding: "10px 13px", background: "#f7f3ff", color: "#5634a5", fontWeight: 700, cursor: "pointer" };
const dateLabel = (value?: string | null) => { if (!value) return "Time unavailable"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString("en-IN"); };

export default function SuperAdminUserActivity() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!userId) { setError("User ID is missing."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const response = await fetch(`${API_BASE_URL}/api/super-admin/users/${encodeURIComponent(userId)}/activity`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      const result = await response.json().catch(() => null) as { activity?: EventRecord[]; message?: string } | null;
      if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); throw new Error("Your session expired. Please sign in again."); }
      if (!response.ok) throw new Error(result?.message || `Unable to load activity (HTTP ${response.status}).`);
      setEvents(Array.isArray(result?.activity) ? result.activity : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load recorded activity."); }
    finally { setLoading(false); }
  }

  // This effect loads audit events when the selected user changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return <main style={{ padding: "clamp(18px, 3vw, 36px)", color: "#302345", minHeight: "70vh" }}>
    <button type="button" style={buttonStyle} onClick={() => navigate("/super-admin/users")}><ArrowLeft size={16} /> Back to users</button>
    <header style={{ margin: "24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div><div style={{ color: "#7650c7", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>USER MANAGEMENT / AUDIT TRAIL</div><h1 style={{ margin: "7px 0" }}>User activity</h1><p style={{ color: "#766b87", margin: 0 }}>Recorded events associated with this account. This is the audit data available to Gradly, not an assertion that every click or session was captured.</p></div>
      <button type="button" style={buttonStyle} disabled={loading} onClick={() => void load()}><RefreshCw size={15} /> {loading ? "Loading…" : "Refresh"}</button>
    </header>
    {error && <section role="alert" style={{ border: "1px solid #f0c8c4", background: "#fff5f4", padding: 16, borderRadius: 12, color: "#9e2f2f" }}>{error}</section>}
    {loading ? <p>Loading recorded activity…</p> : !error && events.length === 0 ? <section style={{ padding: 24, border: "1px solid #e7def7", borderRadius: 16, background: "linear-gradient(145deg,#fff,#f8f4ff)" }}>No matching activity is present in the current audit log.</section> : <section style={{ display: "grid", gap: 12 }}>{events.map((event) => <article key={event.id} style={{ border: "1px solid #e7def7", borderRadius: 14, padding: 16, background: "linear-gradient(145deg,#fff,#faf7ff)", boxShadow: "0 8px 24px rgba(68,42,120,.06)" }}><div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}><strong>{(event.action || "Recorded event").replace(/_/g, " ")}</strong><span style={{ color: "#766b87", fontSize: 12 }}>{dateLabel(event.created_at)}</span></div><p style={{ margin: "8px 0 0", color: "#766b87", fontSize: 13 }}>Actor: {event.actor_role || event.actor_type || "System"}{event.entity_table ? ` · Record: ${event.entity_table}` : ""}{event.entity_id ? ` / ${event.entity_id}` : ""}</p>{event.metadata && Object.keys(event.metadata).length > 0 && <details style={{ marginTop: 10 }}><summary style={{ cursor: "pointer", color: "#6845b5" }}>Event details</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{JSON.stringify(event.metadata, null, 2)}</pre></details>}</article>)}</section>}
  </main>;
}
