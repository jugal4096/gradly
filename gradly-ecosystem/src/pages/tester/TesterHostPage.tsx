import { useEffect, useState } from "react";
import { ArrowLeft, Expand, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./TesterHostPage.css";

const TESTER_RUNTIME_URL = "https://gradly-peach.vercel.app/tester";

export default function TesterHostPage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = "Gradly Tester | Ecosystem";
    return () => { document.title = "Gradly Ecosystem"; };
  }, []);

  return (
    <main className="ecosystem-tester-host">
      <header className="ecosystem-tester-hostbar">
        <button type="button" onClick={() => navigate("/")} aria-label="Back to Ecosystem">
          <ArrowLeft size={17} /> Ecosystem
        </button>
        <div className="ecosystem-tester-hostbrand">
          <FlaskConical size={18} />
          <span>GRADLY TESTER</span>
          <small>VIRTUAL STUDENT ENVIRONMENT</small>
        </div>
        <a href={TESTER_RUNTIME_URL} target="_blank" rel="noreferrer">
          <Expand size={15} /> Open separately
        </a>
      </header>
      {failed ? (
        <section className="ecosystem-tester-error">
          <h1>Tester workspace could not be loaded</h1>
          <p>The embedded student runtime did not respond. Please retry or open the runtime separately.</p>
          <a href={TESTER_RUNTIME_URL} target="_blank" rel="noreferrer">Open Tester runtime</a>
        </section>
      ) : (
        <iframe
          className="ecosystem-tester-frame"
          title="Gradly enrollment-based Tester workspace"
          src={TESTER_RUNTIME_URL}
          allow="clipboard-read; clipboard-write"
          onError={() => setFailed(true)}
        />
      )}
    </main>
  );
}
