import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTester, type TesterAcademicProfile } from "./TesterContext";
import "./TesterEnrollmentPage.css";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

type Branch = { id: string; name: string; code?: string | null; program_id: string; program_name: string; program_level?: string | null };
type Institution = { id: string; name: string; branches: Branch[] };
type Curriculum = { id: string; scheme_name: string; scheme_code?: string | null; version?: string | number | null; total_semesters?: number | null; configured_semesters?: number | null };
type Preview = {
  institution: Institution;
  program: { id: string; name: string };
  branch: Branch;
  admissionYear: number;
  admissionMode: string;
  entrySemester: number;
  candidates: Curriculum[];
};

function normalize(value: string) {
  return String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function programmeMatches(prefix: string, rawName: string) {
  const name = String(rawName || "").normalize("NFKC").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\\s+/g, " ").trim();
  if (!name) return false;
  const engineeringPatterns = [
    /(?:^| )(?:bachelor of engineering|bachelor in engineering|bachelors of engineering|bachelors in engineering|bachelor engineering|bachelors engineering|bachelor of engg|bachelor in engg|bachelor engg|b engg|b e|be)(?: |$)/,
    /(?:^| )(?:bachelor of technology|bachelor in technology|bachelors of technology|bachelors in technology|bachelor technology|bachelors technology|bachelor of tech|b tech|b t e c h|btech|bt)(?: |$)/,
  ];
  const postgraduatePatterns: Record<string, RegExp> = {
    MC: /(?:^| )(?:master of computer applications|master in computer applications|masters of computer applications|master computer applications|m c a|mca|mc)(?: |$)/,
    ME: /(?:^| )(?:master of engineering|master in engineering|masters of engineering|master engineering|master of engg|m engg|m e|me)(?: |$)/,
    MT: /(?:^| )(?:master of technology|master in technology|masters of technology|master technology|master of tech|m tech|m t e c h|mtech|mt)(?: |$)/,
  };
  if (prefix === "BE" || prefix === "BT") return name === "engineering" || name === "undergraduate engineering" || engineeringPatterns.some(pattern => pattern.test(name));
  return Boolean(postgraduatePatterns[prefix]?.test(name));
}

function parseEnrollment(value: string) {
  const enrollment = value.trim().toUpperCase();
  if (!/^(BE|BT|MC|ME|MT)[0-9]{2}[FS][0-9]{2}F[0-9]{3}$/.test(enrollment)) {
    throw new Error("Invalid enrollment number.");
  }
  const prefix = enrollment.slice(0, 2);
  const yy = Number(enrollment.slice(2, 4));
  const admissionYear = yy >= 70 ? 1900 + yy : 2000 + yy;
  const modeCode = enrollment[4];
  const branchCode = enrollment.slice(5, 7);
  const now = new Date();
  const month = now.getMonth() + 1;
  const academicYearStart = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;

  if (admissionYear > academicYearStart) throw new Error("Invalid enrollment number.");
  if (prefix === "BE" && (admissionYear > 2023 || (admissionYear === 2023 && modeCode !== "S"))) throw new Error("Invalid enrollment number.");
  if (prefix === "BT" && admissionYear < 2023) throw new Error("Invalid enrollment number.");
  if (prefix === "BT" && modeCode === "S" && admissionYear > academicYearStart) throw new Error("Invalid enrollment number.");
  if ((prefix === "ME" || prefix === "MT" || prefix === "MC") && modeCode !== "F") throw new Error("Invalid enrollment number.");
  if (prefix === "ME" && admissionYear >= 2023) throw new Error("Invalid enrollment number.");
  if (prefix === "MT" && admissionYear < 2023) throw new Error("Invalid enrollment number.");

  return { enrollment, prefix, admissionYear, modeCode, branchCode, academicYearStart, semesterOffset: month >= 7 && month <= 12 ? 0 : 1 };
}

function decodedBranch(institutionName: string, prefix: string, code: string): string | null {
  const institution = normalize(institutionName);
  const isGeca = institution.includes("governmentcollegeofengineering") &&
    (institution.includes("aurangabad") || institution.includes("chhatrapatisambhajinagar") || institution.includes("sambhajinagar"));
  if (isGeca) {
    if (prefix === "BE" || prefix === "BT") {
      return ({
        "01": "Civil Engineering",
        "02": "Mechanical Engineering",
        "03": "Electrical Engineering",
        "04": "Electronics and Telecommunication Engineering",
        "05": "Computer Science and Engineering",
        "06": "Information Technology",
      } as Record<string, string>)[code] || null;
    }
    if (prefix === "MT") {
      return ({
        "09": "Applied Mechanics",
        "08": "Civil Engineering",
        "16": "Civil Engineering",
        "15": "Electrical Engineering",
        "12": "Electrical Engineering",
        "13": "Electronics and Telecommunication Engineering",
        "05": "Computer Science and Engineering",
      } as Record<string, string>)[code] || null;
    }
  }
  return null;
}

function branchMatches(candidate: Branch, decoded: string | null, code: string) {
  if (!decoded) return String(candidate.code || "").trim().toUpperCase() === code;
  const actual = normalize(candidate.name);
  const expected = normalize(decoded);
  if (actual === expected || actual.includes(expected) || expected.includes(actual)) return true;
  const aliases: Record<string, string[]> = {
    informationtechnology: ["it"],
    computerscienceandengineering: ["computerscience", "cse", "computerengineering"],
    electronicsandtelecommunicationengineering: ["electronicsandcommunicationengineering", "entc", "etc", "ece"],
    electricalengineering: ["electrical", "ee"],
    mechanicalengineering: ["mechanical", "mech"],
    civilengineering: ["civil", "ce"],
  };
  return (aliases[expected] || []).some(alias => actual === alias || actual.includes(alias));
}

function allowedCurricula(prefix: string, curricula: Curriculum[]) {
  if (prefix === "BE" || prefix === "ME") return curricula.filter(item => /^new cbcs(?:\s|$)/i.test(item.scheme_name.trim()) && !/\b(nep|new education policy|national education policy)\b/i.test(item.scheme_name));
  if (prefix === "BT" || prefix === "MT") return curricula.filter(item => /\b(nep|new education policy|national education policy)\b/i.test(item.scheme_name) && !/\b(cbcs|legacy)\b/i.test(item.scheme_name));
  return curricula;
}

export default function TesterEnrollmentPage() {
  const navigate = useNavigate();
  const { isTester, enterTester, setTesterProfile, exitTester } = useTester();
  const { clearGuestMode } = useAuth();

  useEffect(() => { clearGuestMode(); if (!isTester) enterTester(); }, []);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [curriculumId, setCurriculumId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(API + "/api/academic/institutions");
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load institution directory.");
        const rows = Array.isArray(data.data) ? data.data as Institution[] : [];
        if (!cancelled) {
          setInstitutions(rows);
          const preferred = rows.find(item => normalize(item.name).includes("governmentcollegeofengineering") && (normalize(item.name).includes("aurangabad") || normalize(item.name).includes("sambhajinagar")));
          setInstitutionId(preferred?.id || rows[0]?.id || "");
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load institution directory.");
      } finally {
        if (!cancelled) setLoadingInstitutions(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedInstitution = useMemo(() => institutions.find(item => item.id === institutionId) || null, [institutions, institutionId]);

  function clearResolution(nextEnrollment: string) {
    setEnrollment(nextEnrollment);
    setPreview(null);
    setCurriculumId("");
    setError("");
    setTesterProfile(null);
  }

  async function resolve(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPreview(null);
    setCurriculumId("");
    if (!selectedInstitution) { setError("Select an institution first."); return; }
    let parsed: ReturnType<typeof parseEnrollment>;
    try { parsed = parseEnrollment(enrollment); }
    catch (parseError) { setError(parseError instanceof Error ? parseError.message : "Invalid enrollment number."); return; }

    setResolving(true);
    try {
      const programs = Array.from(new Map(selectedInstitution.branches.map(branch => [branch.program_id, { id: branch.program_id, name: branch.program_name }])).values());
      const matchingPrograms = programs.filter(program => programmeMatches(parsed.prefix, program.name));
      if (matchingPrograms.length !== 1) throw new Error(matchingPrograms.length ? "More than one programme matches this enrollment prefix. Institutional mapping needs review." : "No programme in this institution matches the enrollment prefix.");

      const program = matchingPrograms[0];
      const decoded = decodedBranch(selectedInstitution.name, parsed.prefix, parsed.branchCode);
      const matchingBranches = selectedInstitution.branches.filter(branch => branch.program_id === program.id && branchMatches(branch, decoded, parsed.branchCode));
      const uniqueBranches = Array.from(new Map(matchingBranches.map(branch => [branch.id, branch])).values());
      if (uniqueBranches.length !== 1) throw new Error(uniqueBranches.length ? "More than one branch matches this enrollment code. Institutional mapping needs review." : "Unrecognized branch code for the selected institution.");

      const branch = uniqueBranches[0];
      if ((parsed.prefix === "BE" || parsed.prefix === "ME") && parsed.prefix === "BE" && !/information technology/i.test(branch.name)) {
        throw new Error("New CBCS is no longer supported for this branch. The supported New CBCS branch is Information Technology.");
      }

      const modeParams = new URLSearchParams({ institutionId: selectedInstitution.id, programmePrefix: parsed.prefix });
      const modeResponse = await fetch(API + "/api/academic/admission-modes?" + modeParams.toString());
      const modePayload = await modeResponse.json();
      if (!modeResponse.ok) throw new Error(modePayload.message || "Unable to resolve admission mode.");
      const mode = (Array.isArray(modePayload.data) ? modePayload.data : []).find((item: { mode_code?: string }) => String(item.mode_code || "").toUpperCase() === parsed.modeCode);
      const entrySemester = Number(mode?.entry_semester || (parsed.prefix === "BE" || parsed.prefix === "BT" ? (parsed.modeCode === "S" ? 3 : 1) : 1));
      const admissionMode = String(mode?.mode_name || (parsed.modeCode === "S" ? "Direct Second Year" : "Regular Admission"));

      const params = new URLSearchParams({ institutionId: selectedInstitution.id, programId: program.id, branchId: branch.id });
      const curriculumResponse = await fetch(API + "/api/academic/curricula?" + params.toString());
      const curriculumPayload = await curriculumResponse.json();
      if (!curriculumResponse.ok) throw new Error(curriculumPayload.message || "Unable to load curriculum directory.");
      const candidates = allowedCurricula(parsed.prefix, Array.isArray(curriculumPayload.data) ? curriculumPayload.data as Curriculum[] : []);
      if (!candidates.length) throw new Error("No eligible curriculum is configured for this enrollment number.");
      const previewData: Preview = { institution: selectedInstitution, program, branch, admissionYear: parsed.admissionYear, admissionMode, entrySemester, candidates };
      setPreview(previewData);
      if (candidates.length === 1) setCurriculumId(candidates[0].id);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Unable to identify this enrollment number.");
    } finally {
      setResolving(false);
    }
  }

  function openWorkspace() {
    if (!preview) return;
    const curriculum = preview.candidates.find(item => item.id === curriculumId);
    if (!curriculum) { setError("Choose the curriculum to preview."); return; }
    const totalSemesters = Number(curriculum.total_semesters || curriculum.configured_semesters || (preview.program.name.toLowerCase().includes("mca") || /m\.?tech/i.test(preview.program.name) ? 4 : 8));
    if (!Number.isInteger(totalSemesters) || totalSemesters < preview.entrySemester) { setError("The selected curriculum has an invalid semester configuration."); return; }
    const now = new Date();
    const month = now.getMonth() + 1;
    const academicYearStart = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const semesterOffset = month >= 7 && month <= 12 ? 0 : 1;
    const predicted = preview.entrySemester + (academicYearStart - preview.admissionYear) * 2 + semesterOffset;
    const semester = Math.max(preview.entrySemester, Math.min(totalSemesters, predicted));
    const profile: TesterAcademicProfile = {
      institutionId: preview.institution.id,
      institutionName: preview.institution.name,
      programId: preview.program.id,
      programName: preview.program.name,
      branchId: preview.branch.id,
      branchName: preview.branch.name,
      curriculumId: curriculum.id,
      semester: String(semester),
      enrollment: enrollment.trim().toUpperCase(),
      admissionYear: String(preview.admissionYear),
      admissionMode: preview.admissionMode,
      admissionNumber: "",
      scheme: curriculum.scheme_name,
    };
    setTesterProfile(profile);
    navigate("/tester/workspace", { replace: true });
  }

  function leaveTester() {
    exitTester();
    navigate("/", { replace: true });
  }

  return (
    <main className="tester-entry-page">
      <header className="tester-entry-header">
        <a href="/" className="tester-entry-brand"><span>G</span> gradly</a>
        <button type="button" className="tester-exit-link" onClick={leaveTester}>Exit tester</button>
      </header>
      <section className="tester-entry-card">
        <span className="tester-entry-kicker">GRADLY / EXPERIMENTAL WORKSPACE</span>
        <h1>Continue as Tester</h1>
        <p>Enter an enrollment number to preview the same student workspace with its institution, programme, branch, scheme, semester and curriculum subjects.</p>
        <form onSubmit={resolve}>
          <label>Institution
            <select value={institutionId} onChange={event => { setInstitutionId(event.target.value); setPreview(null); setCurriculumId(""); setError(""); }} disabled={loadingInstitutions || resolving}>
              {institutions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Enrollment number
            <input value={enrollment} onChange={event => clearResolution(event.target.value)} placeholder="Enter 11-character enrollment number" maxLength={11} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
          </label>
          {error && <p className="tester-entry-error" role="alert">{error}</p>}
          <button className="tester-entry-primary" type="submit" disabled={loadingInstitutions || resolving || !selectedInstitution || !enrollment.trim()}>{resolving ? "Identifying enrollment…" : "Identify enrollment →"}</button>
        </form>
        {preview && <section className="tester-preview-details">
          <div className="tester-preview-heading"><div><span>IDENTIFIED ACADEMIC PROFILE</span><h2>{preview.program.name}</h2></div><span className="tester-preview-status">READ ONLY</span></div>
          <dl>
            <div><dt>Institution</dt><dd>{preview.institution.name}</dd></div>
            <div><dt>Branch</dt><dd>{preview.branch.name}</dd></div>
            <div><dt>Enrollment</dt><dd>{enrollment.trim().toUpperCase()}</dd></div>
            <div><dt>Admission year</dt><dd>{preview.admissionYear}</dd></div>
            <div><dt>Admission mode</dt><dd>{preview.admissionMode}</dd></div>
          </dl>
          <label>Curriculum scheme
            <select value={curriculumId} onChange={event => setCurriculumId(event.target.value)}>
              <option value="">Select scheme</option>
              {preview.candidates.map(item => <option key={item.id} value={item.id}>{item.scheme_name}{item.version ? " · v" + item.version : ""}</option>)}
            </select>
          </label>
          {preview.candidates.length > 1 && <p className="tester-entry-hint">More than one eligible curriculum is configured. Select the scheme used for this enrollment.</p>}
          <button className="tester-entry-primary" type="button" onClick={openWorkspace} disabled={!curriculumId}>Open student workspace →</button>
        </section>}
        <p className="tester-entry-footnote">Tester data exists only in this open browser session. It is not saved to a student account or the database. Refreshing or exiting clears the preview.</p>
      </section>
    </main>
  );
}
