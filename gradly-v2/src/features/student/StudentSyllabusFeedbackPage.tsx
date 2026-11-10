import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { auth } from "../../config/firebase";

const API_ROOT = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";

export default function StudentSyllabusFeedbackPage() {
  const [requestType, setRequestType] = useState("SYLLABUS_CHANGE");
  const [semesterNumber, setSemesterNumber] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in to submit syllabus feedback.");
      const token = await user.getIdToken();
      const response = await fetch(API_ROOT + "/student/syllabus-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, Accept: "application/json" },
        body: JSON.stringify({ requestType, semesterNumber: semesterNumber || null, subjectName, message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to submit your feedback.");
      setSuccess("Your feedback has been submitted to your department for review.");
      setSemesterNumber(""); setSubjectName(""); setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit feedback.");
    } finally { setBusy(false); }
  }

  return <main className="student-service-page">
    <div className="student-service-shell">
      <nav className="student-service-nav"><Link to="/dashboard">← Back to Gradly</Link><Link to="/notifications">Notifications</Link></nav>
      <section className="student-service-card">
        <p className="student-service-eyebrow">STUDENT VOICE</p>
        <h1>Syllabus feedback</h1>
        <p>Suggest a syllabus correction, missing subject, credit update or other academic improvement. Your request will be reviewed by your department; official curriculum changes require Super Admin approval.</p>
        {error && <p className="student-service-error" role="alert">{error}</p>}
        {success && <p className="student-service-success" role="status">{success}</p>}
        <form onSubmit={submit} className="student-service-form">
          <label>Request type<select value={requestType} onChange={e => setRequestType(e.target.value)}><option value="SYLLABUS_CHANGE">Request a syllabus change</option><option value="SYLLABUS_FEEDBACK">General syllabus feedback</option><option value="MISSING_SUBJECT">Missing subject</option><option value="CREDIT_CORRECTION">Credit correction</option><option value="OTHER">Other academic feedback</option></select></label>
          <div className="student-service-grid">
            <label>Semester (optional)<select value={semesterNumber} onChange={e => setSemesterNumber(e.target.value)}><option value="">Not specified</option>{Array.from({length: 12}, (_, i) => <option key={i + 1} value={i + 1}>Semester {i + 1}</option>)}</select></label>
            <label>Subject (optional)<input value={subjectName} onChange={e => setSubjectName(e.target.value)} maxLength={180} placeholder="Subject name or code" /></label>
          </div>
          <label>Explain your request<textarea value={message} onChange={e => setMessage(e.target.value)} required minLength={10} maxLength={3000} rows={6} placeholder="Describe the issue or change you recommend (10–3,000 characters)." /></label>
          <p className="student-service-note">Your identity is used to associate the request with your academic department, but is not shown to department administrators in the feedback inbox.</p>
          <button disabled={busy} type="submit">{busy ? "Submitting…" : "Submit feedback"}</button>
        </form>
      </section>
    </div>
  </main>;
}
