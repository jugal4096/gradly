import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../lib/superAdminSession";
import "./Tester.css";

const API = API_BASE_URL.replace(/\\/+$/, "");
const STUDENT_APP = (import.meta.env.VITE_STUDENT_APP_URL || (window.location.hostname === "localhost" ? "http://localhost:5173" : "https://gradly-peach.vercel.app")).replace(/\\/+$/, "");

export default function TesterWorkspace() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    const token = sessionStorage.getItem("gradly_tester_access_token");
    const loginId = sessionStorage.getItem("gradly_tester_login_id") || "Tester";
    if (!token) { navigate("/tester/login", { replace: true }); return; }
    let active = true;
    fetch(API + "/api/tester/me", { headers: { Authorization: "Bearer " + token } })
      .then(async response => {
        if (!response.ok) throw new Error("Tester access is inactive or expired. Contact your Super Admin.");
        return response.json();
      })
      .then(() => {
        if (!active) return;
        const destination = new URL(STUDENT_APP + "/academic-setup");
        const params = new URLSearchParams();
        params.set("testerToken", token);
        params.set("testerId", loginId);
        params.set("testerReturnUrl", window.location.origin + "/tester/login");
        destination.hash = params.toString();
        sessionStorage.removeItem("gradly_tester_access_token");
        window.location.replace(destination.toString());
      })
      .catch(reason => {
        if (!active) return;
        sessionStorage.removeItem("gradly_tester_access_token");
        setError(reason instanceof Error ? reason.message : "Unable to open the student workspace.");
      });
    return () => { active = false; };
  }, [navigate]);

  return <main className="tester-loading" role="status">
    {error ? <><p>{error}</p><button onClick={()=>navigate("/tester/login",{replace:true})}>Return to tester login</button></> : "Verifying tester access and opening Gradly V2 student workspace…"}
  </main>;
}
