import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminWorkspaceMenu from "./AdminWorkspaceMenu";
import "./AdminDashboard.css";
import "./CommunitiesAdminPage.css";

const API = "https://gradly-communities-api.jugalpkhr.workers.dev";
type Report = { id: string; reason: string; details: string; status: string; created_at: string; group_name?: string; reporter_name?: string };
type Overview = { activeUsers: number; activeGroups: number; messages: number; openReports: number };
type ReportDetail = { report: Report; reportedMessage: { body: string; sender_id: string; created_at: string } | null };

async function request(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", "Bearer " + token);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(API + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.error || "Communities request failed.");
  return data;
}

export default function CommunitiesAdminPage() {
  const navigate = useNavigate();
  const [token] = useState(() => localStorage.getItem("gradly_admin_token") || "");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    if (!token) { navigate("/admin/login", { replace: true }); return; }
    setLoading(true); setError("");
    try {
      const [summary, queue] = await Promise.all([
        request("/ecosystem/admin/overview", token),
        request("/ecosystem/admin/reports", token)
      ]);
      setOverview(summary.overview);
      setReports(queue.reports || []);
      setForbidden(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to load Communities moderation.";
      setError(message);
      setForbidden(message.toLowerCase().includes("not been granted") || message.toLowerCase().includes("permission"));
    } finally { setLoading(false); }
  }, [navigate, token]);

  useEffect(() => { void load(); }, [load]);

  const openReport = async (report: Report) => {
    try { setSelected(await request("/ecosystem/admin/reports/" + report.id, token)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to open report."); }
  };

  const resolveReport = async (status: "resolved" | "dismissed") => {
    if (!selected) return;
    const reason = window.prompt("Add a short moderation note (optional):") || "";
    setBusyId(selected.report.id);
    try {
      await request("/ecosystem/admin/reports/" + selected.report.id + "/resolve", token, {
        method: "POST", body: JSON.stringify({ status, reason })
      });
      setSelected(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update report."); }
    finally { setBusyId(""); }
  };

  return <><AdminWorkspaceMenu/><main className="ca-page">
    <header className="ca-header"><div><span>GRADLY ECOSYSTEM / ADMIN</span><h1>Communities management</h1><p>Review reported content and keep student study spaces safe.</p></div><button onClick={() => void load()} disabled={loading}>↻ Refresh</button></header>
    {error && <div className="ca-alert">{error}</div>}
    {forbidden ? <section className="ca-empty"><h2>Communities access is not enabled</h2><p>Your existing Admin account needs an explicit Communities Platform Admin permission from the Super Admin.</p></section> : <>
      <section className="ca-metrics">
        <article><small>ACTIVE COMMUNITIES USERS</small><strong>{loading ? "—" : overview?.activeUsers ?? 0}</strong></article>
        <article><small>ACTIVE GROUPS</small><strong>{loading ? "—" : overview?.activeGroups ?? 0}</strong></article>
        <article><small>MESSAGES</small><strong>{loading ? "—" : overview?.messages ?? 0}</strong></article>
        <article><small>OPEN REPORTS</small><strong>{loading ? "—" : overview?.openReports ?? 0}</strong></article>
      </section>
      <section className="ca-card"><div className="ca-card-heading"><div><span>MODERATION QUEUE</span><h2>Reports requiring review</h2></div><small>{reports.length} open</small></div>
        {reports.length ? reports.map((report) => <button className="ca-report" key={report.id} onClick={() => void openReport(report)}><span className="ca-report-icon">!</span><span><b>{report.reason.replaceAll("_"," ")}</b><small>{report.group_name || "Group unavailable"} · Reported by {report.reporter_name || "student"} · {new Date(report.created_at).toLocaleString()}</small></span><strong>Review →</strong></button>) : <p className="ca-empty-inline">{loading ? "Loading reports…" : "No open reports. Nice and quiet."}</p>}
      </section>
      {selected && <section className="ca-detail"><div className="ca-card-heading"><div><span>REPORTED CASE</span><h2>{selected.report.reason.replaceAll("_"," ")}</h2></div><button onClick={() => setSelected(null)}>Close</button></div><p>{selected.report.details || "No additional details were provided."}</p>{selected.reportedMessage && <blockquote>{selected.reportedMessage.body}</blockquote>}<div className="ca-actions"><button onClick={() => void resolveReport("dismissed")} disabled={!!busyId}>Dismiss report</button><button className="primary" onClick={() => void resolveReport("resolved")} disabled={!!busyId}>Resolve report</button></div><small>Message content is displayed only because it is part of this reported case. Access is recorded in the audit log.</small></section>}
    </>}
  </main></>;
}
