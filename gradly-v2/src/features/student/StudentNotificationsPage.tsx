import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../../config/firebase";

type StudentNotification = { id: string; type: string; title: string; message: string; actionUrl: string | null; readAt: string | null; createdAt: string };
const API_ROOT = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";

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
    setLoading(true); setError("");
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
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markRead(item: StudentNotification) {
    if (item.readAt) return;
    setBusyId(item.id); setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in to update notifications.");
      const token = await user.getIdToken();
      const response = await fetch(API_ROOT + "/auth/notifications/" + encodeURIComponent(item.id) + "/read", { method: "PATCH", headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to mark notification as read.");
      setNotifications(current => current.map(notification => notification.id === item.id ? { ...notification, readAt: data.notification?.readAt || new Date().toISOString() } : notification));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update notification.");
    } finally { setBusyId(null); }
  }

  const unread = notifications.filter(item => !item.readAt).length;
  return <main className="student-service-page"><div className="student-service-shell">
    <nav className="student-service-nav"><Link to="/dashboard">← Back to Gradly</Link><Link to="/syllabus-feedback">Syllabus feedback</Link></nav>
    <section className="student-service-card">
      <p className="student-service-eyebrow">GRADLY / INBOX</p><h1>Notifications</h1><p>{unread} unread · {notifications.length} total</p>
      <button type="button" className="student-service-secondary" onClick={() => void load()} disabled={loading}>Refresh</button>
      {error && <p className="student-service-error" role="alert">{error}</p>}
      {loading ? <p className="student-service-empty">Loading your notifications…</p> : notifications.length === 0 ? <div className="student-service-empty"><h2>You're all caught up</h2><p>Messages from Gradly Super Admin will appear here.</p></div> :
        <div className="student-notification-list">{notifications.map(item => <article className={item.readAt ? "student-notification" : "student-notification unread"} key={item.id}>
          <div><div className="student-notification-meta"><strong>{item.type.replace(/_/g, " ")}</strong>{!item.readAt && <span>NEW</span>}<time>{formatDate(item.createdAt)}</time></div>
            <h2>{item.title}</h2><p>{item.message}</p>{item.actionUrl && <Link to={item.actionUrl}>Open related section →</Link>}
          </div>
          <div>{item.readAt ? <span aria-label="Read">✓</span> : <button type="button" className="student-service-secondary" onClick={() => void markRead(item)} disabled={busyId === item.id}>{busyId === item.id ? "…" : "Mark read"}</button>}</div>
        </article>)}</div>}
      <p className="student-service-note">Notifications are private to your Gradly account.</p>
    </section>
  </div></main>;
}
