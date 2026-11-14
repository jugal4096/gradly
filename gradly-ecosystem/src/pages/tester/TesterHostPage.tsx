import { useEffect, useState } from "react";
import { ArrowLeft, FlaskConical, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./TesterHostPage.css";

const TESTER_RUNTIME_URL = "https://gradly-peach.vercel.app/tester";

export default function TesterHostPage() {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);

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
        <button type="button" onClick={() => setReloadKey(value => value + 1)}>
          <RefreshCw size={15} /> Reload
        </button>
      </header>
      <iframe
        key={reloadKey}
        className="ecosystem-tester-frame"
        title="Gradly enrollment-based Tester workspace"
        src={TESTER_RUNTIME_URL}
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}
