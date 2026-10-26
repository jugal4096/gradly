import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import "./GuestSetupPage.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const LOGO_URL = "https://raw.githubusercontent.com/jugal4096/gradly/fix/gradly-audit-2026-10-17/gradly-ecosystem/public/gradly-ecosystem-logo.png";
type GuestInstitution = { id: string; name: string };
type ExternalInstitution = { externalId: string; name: string; city: string; region: string; country: string; homepageUrl: string | null };

export default function GuestSetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [guestId, setGuestId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [externalInstitutions, setExternalInstitutions] = useState<ExternalInstitution[]>([]);
  const [selectedExternalInstitution, setSelectedExternalInstitution] = useState<ExternalInstitution | null>(null);
  const [searchingInstitutions, setSearchingInstitutions] = useState(false);
  const [institutionSearchError, setInstitutionSearchError] = useState("");
  const [institutions, setInstitutions] = useState<GuestInstitution[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [startingGuest, setStartingGuest] = useState(false);
  const [error, setError] = useState("");
  const [showInstitutionRequest, setShowInstitutionRequest] = useState(false);
  const [collegeName, setCollegeName] = useState("");
  const [locality, setLocality] = useState("");
  const [requestingInstitution, setRequestingInstitution] = useState(false);
  const [institutionRequestSent, setInstitutionRequestSent] = useState(false);
  const [institutionRequestError, setInstitutionRequestError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/guest/institutions`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || "Could not load institutions.");
        if (!cancelled) setInstitutions(Array.isArray(data?.institutions) ? data.institutions : []);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load institutions.");
      })
      .finally(() => { if (!cancelled) setLoadingInstitutions(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const query = institutionSearch.trim();
    if (query.length < 2 || step !== 2) {
      setExternalInstitutions([]);
      setInstitutionSearchError("");
      setSearchingInstitutions(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearchingInstitutions(true);
        setInstitutionSearchError("");
        const response = await fetch(`${API_BASE_URL}/api/guest/institution-search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || "Could not search the institution directory.");
        setExternalInstitutions(Array.isArray(data?.institutions) ? data.institutions : []);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setExternalInstitutions([]);
          setInstitutionSearchError(cause instanceof Error ? cause.message : "Could not search institutions.");
        }
      } finally {
        if (!controller.signal.aborted) setSearchingInstitutions(false);
      }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [institutionSearch, step]);

  function continueToInstitution() {
    const normalized = guestId.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{3,23}$/.test(normalized)) {
      setError("Use 4–24 characters: letters, numbers, hyphens or underscores.");
      return;
    }
    setGuestId(normalized);
    setError("");
    setStep(2);
  }

  async function handleInstitutionRequest() {
    if (collegeName.trim().length < 2 || locality.trim().length < 2) {
      setInstitutionRequestError("Please enter both the college name and its locality or city.");
      return;
    }
    try {
      setRequestingInstitution(true);
      setInstitutionRequestError("");
      const response = await fetch(`${API_BASE_URL}/api/guest/institution-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeName: collegeName.trim(), locality: locality.trim(), guestId, externalInstitutionId: selectedExternalInstitution?.externalId ?? "" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Could not send your institution request.");
      setInstitutionRequestSent(true);
    } catch (cause) {
      setInstitutionRequestError(cause instanceof Error ? cause.message : "Could not send your institution request.");
    } finally {
      setRequestingInstitution(false);
    }
  }

  async function handleGuestStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 2 || (!institutionId && !selectedExternalInstitution)) {
      setError("Select your institution from the Gradly list or live search.");
      return;
    }
    try {
      setError("");
      setStartingGuest(true);
      const response = await fetch(`${API_BASE_URL}/api/guest/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: guestId.trim().toUpperCase(), institutionId, ...(selectedExternalInstitution ? { institutionName: selectedExternalInstitution.name, institutionLocality: [selectedExternalInstitution.city, selectedExternalInstitution.region, selectedExternalInstitution.country].filter(Boolean).join(", "), externalInstitutionId: selectedExternalInstitution.externalId } : {}) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "We couldn't start Guest Mode. Please try again.");
      const guest = data.guest;
      sessionStorage.setItem("gradly_guest_session_token", guest.sessionToken);
      sessionStorage.setItem("gradly_guest_profile", JSON.stringify({
        id: guest.id, guestId: guest.guestId, displayName: guest.displayName,
        institutionId: guest.institutionId, institutionName: guest.institutionName,
        expiresAt: guest.expiresAt,
      }));
      navigate("/guest", { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Guest Mode could not be started.";
      setError(message);
      if (message.toLowerCase().includes("guest id is already in use")) setStep(1);
    } finally {
      setStartingGuest(false);
    }
  }

  return (
    <main className="gradly-landing gradly-landing--minimal guest-setup-page">
      <div className="login-backdrop" aria-hidden="true">
        <div className="login-backdrop__slide login-backdrop__slide--one" />
        <div className="login-backdrop__slide login-backdrop__slide--two" />
        <div className="login-backdrop__slide login-backdrop__slide--three" />
        <div className="login-backdrop__slide login-backdrop__slide--four" />
        <div className="login-backdrop__shade" />
      </div>
      <div className="landing-noise" aria-hidden="true" />
      <header className="landing-nav landing-nav--minimal guest-setup-nav">
        <button className="guest-setup-back" type="button" onClick={() => navigate("/login")}>← <span>Back to sign in</span></button>
        <a className="landing-brand" href="/login" aria-label="Gradly home">
          <img src={LOGO_URL} alt="Gradly" />
          <span className="landing-brand__fallback" aria-hidden="true">gradly<span>.</span></span>
        </a>
        <span className="landing-nav__tag">GUEST MODE</span>
      </header>

      <section className="guest-setup-stage" aria-labelledby="guest-setup-title">
        <div className="guest-setup-card">
          <div className="guest-setup-card__intro">
            <span className="guest-setup-card__eyebrow"><i /> YOUR SPACE, YOUR PACE</span>
            <h1 id="guest-setup-title">{step === 1 ? <>A little space<br /><em>to get started.</em></> : <>One last step<br /><em>before you’re in.</em></>}</h1>
            <p>{step === 1 ? "Create a guest identity and try Gradly’s academic calculators—no full account setup needed." : "Choose your institution for your guest profile. Your calculator workspace stays generic and flexible."}</p>
            <div className="guest-benefits">
              <div><span>01</span><p><strong>Try SGPA & CGPA</strong><small>Experiment with your own numbers</small></p></div>
              <div><span>02</span><p><strong>Keep a guest workspace</strong><small>Save work during this guest session</small></p></div>
              <div><span>03</span><p><strong>Upgrade whenever you want</strong><small>Sign in later for personalized tools</small></p></div>
            </div>
          </div>

          <form className="guest-setup-form" onSubmit={handleGuestStart}>
            <div className="guest-setup-progress"><span className={step === 1 ? "is-current" : "is-complete"}>1</span><i className={step === 2 ? "is-complete" : ""} /><span className={step === 2 ? "is-current" : ""}>2</span><small>STEP {step} OF 2</small></div>
            {step === 1 ? <>
              <div className="guest-setup-form__heading"><span>LET’S MAKE IT YOURS</span><h2>Choose a Guest ID</h2><p>This unique ID identifies your temporary Gradly workspace.</p></div>
              <label htmlFor="guest-id">Your Guest ID</label>
              <input id="guest-id" value={guestId} onChange={(event) => setGuestId(event.target.value.replace(/\s/g, "").toUpperCase())} minLength={4} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9_-]{3,23}" placeholder="e.g. JUGAL-01" autoComplete="off" autoFocus required />
              <small className="guest-setup-form__hint">4–24 characters · letters, numbers, _ or -</small>
              <button className="guest-setup-form__submit" type="button" onClick={continueToInstitution}>Continue <span>→</span></button>
            </> : <>
              <div className="guest-setup-form__heading"><span>YOUR ID IS READY</span><h2>Select institution</h2><p>We’ll remember this choice on your guest profile.</p></div>
              <div className="guest-setup-form__identity"><span>GUEST ID</span><strong>{guestId}</strong><button type="button" onClick={() => { setError(""); setStep(1); }}>Edit</button></div>
              <label htmlFor="guest-institution">Institution</label>
              <select id="guest-institution" value={institutionId} onChange={(event) => { setInstitutionId(event.target.value); setSelectedExternalInstitution(null); setError(""); }} required={!selectedExternalInstitution} disabled={loadingInstitutions || startingGuest}>
                <option value="">{loadingInstitutions ? "Loading institutions…" : "Choose your institution"}</option>
                {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
              </select>
              <div className="guest-live-institution-search">
                <label htmlFor="guest-institution-search">Or search real colleges and universities</label>
                <input id="guest-institution-search" value={institutionSearch} onChange={(event) => { setInstitutionSearch(event.target.value); setInstitutionId(""); setSelectedExternalInstitution(null); setError(""); }} maxLength={100} placeholder="Search college or university name…" autoComplete="off" disabled={startingGuest} />
                <small className="guest-setup-form__hint">Live institution directory · city and state shown when available · India</small>
                {searchingInstitutions && <small className="guest-live-search-status">Searching institutions…</small>}
                {institutionSearchError && <small className="guest-live-search-error" role="status">{institutionSearchError}</small>}
                {externalInstitutions.length > 0 && !selectedExternalInstitution && (
                  <div className="guest-live-institution-results" role="listbox" aria-label="Live institution results">
                    {externalInstitutions.map((institution) => (
                      <button key={institution.externalId} type="button" role="option" aria-selected="false" onClick={() => { setSelectedExternalInstitution(institution); setInstitutionId(""); setInstitutionSearch(institution.name); setCollegeName(institution.name); setLocality([institution.city, institution.region, institution.country].filter(Boolean).join(", ")); setShowInstitutionRequest(false); setError(""); }}>
                        <strong>{institution.name}</strong>
                        <span>{[institution.city, institution.region, institution.country].filter(Boolean).join(", ") || "Location not listed"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedExternalInstitution && (
                  <div className="guest-live-institution-selected">
                    <span>SELECTED FROM LIVE DIRECTORY</span>
                    <strong>{selectedExternalInstitution.name}</strong>
                    <small>{[selectedExternalInstitution.city, selectedExternalInstitution.region, selectedExternalInstitution.country].filter(Boolean).join(", ") || "Location not listed"}</small>
                    <button type="button" onClick={() => { setSelectedExternalInstitution(null); setInstitutionSearch(""); }}>Change selection</button>
                  </div>
                )}
                {institutionSearch.trim().length >= 2 && !searchingInstitutions && !institutionSearchError && externalInstitutions.length === 0 && !selectedExternalInstitution && (
                  <small className="guest-live-search-status">No live matches. Try another spelling or request that your college be added below.</small>
                )}
              </div>
              <div className="guest-institution-missing">
                <span>Can’t find your college?</span>
                <button type="button" onClick={() => { setShowInstitutionRequest((visible) => !visible); setInstitutionRequestError(""); }}>
                  Your institution isn’t listed? Contact Super Admin
                </button>
              </div>
              {showInstitutionRequest && (
                <section className="guest-institution-request" aria-label="Request an institution to be added">
                  {institutionRequestSent ? (
                    <div className="guest-institution-request__success" role="status">
                      <strong>Request sent successfully!</strong>
                      <p>Your request is now available in the Super Admin’s Feedback & Requests inbox.</p>
                    </div>
                  ) : (
                    <>
                      <div className="guest-institution-request__heading">
                        <strong>Request your institution</strong>
                        <p>Share these details and we’ll review adding it to Gradly.</p>
                      </div>
                      <label htmlFor="request-college-name">College / Institution name</label>
                      <input id="request-college-name" value={collegeName} onChange={(event) => setCollegeName(event.target.value)} maxLength={160} placeholder="e.g. Government College of Engineering" autoComplete="organization" />
                      <label htmlFor="request-college-locality">Locality / City</label>
                      <input id="request-college-locality" value={locality} onChange={(event) => setLocality(event.target.value)} maxLength={120} placeholder="e.g. Chhatrapati Sambhajinagar, Maharashtra" autoComplete="address-level2" />
                      <div className="guest-institution-request__proforma">
                        <span>EMAIL PROFORMA</span>
                        <p><b>To:</b> jugalpkhr@gmail.com</p>
                        <p><b>Subject:</b> Gradly institution request — {collegeName.trim() || "[College name]"}</p>
                        <p><b>Details:</b> {collegeName.trim() || "[College name]"} · {locality.trim() || "[Locality / City]"} · Guest ID: {guestId}</p>
                      </div>
                      <button className="guest-institution-request__submit" type="button" onClick={handleInstitutionRequest} disabled={requestingInstitution}>
                        {requestingInstitution ? "Sending request…" : "Send request to admin"} <span>↗</span>
                      </button>
                      <small className="guest-setup-form__hint">This submits your request directly to the Super Admin inbox for review.</small>
                    </>
                  )}
                  {institutionRequestError && <p className="guest-setup-error" role="alert">{institutionRequestError}</p>}
                </section>
              )}
              <button className="guest-setup-form__submit" type="submit" disabled={startingGuest || loadingInstitutions || (!institutionId && !selectedExternalInstitution) || (institutions.length === 0 && !selectedExternalInstitution)}>{startingGuest ? "Creating workspace…" : "Enter Guest Mode"} <span>↗</span></button>
            </>}
            {error && <p className="guest-setup-error" role="alert">{error}</p>}
            <p className="guest-setup-form__footnote"><span>◈</span> Guest mode includes SGPA and CGPA calculators. Personalized student features require sign-in.</p>
          </form>
        </div>
      </section>
      <footer className="landing-footer landing-footer--minimal guest-setup-footer"><a className="landing-footer__brand" href="/login">gradly<span>.</span></a><span>SMALL STEPS. CLEARER GOALS.</span></footer>
    </main>
  );
}
