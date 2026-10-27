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
  const [institutions, setInstitutions] = useState<GuestInstitution[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [startingGuest, setStartingGuest] = useState(false);
  const [error, setError] = useState("");
  const [showInstitutionRequest, setShowInstitutionRequest] = useState(false);
  const [collegeName, setCollegeName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [indianStates, setIndianStates] = useState<string[]>([]);
  const [requestState, setRequestState] = useState("");
  const [indianCities, setIndianCities] = useState<string[]>([]);
  const [requestCity, setRequestCity] = useState("");
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [locationLookupError, setLocationLookupError] = useState("");
  const [requestCollegeMatches, setRequestCollegeMatches] = useState<ExternalInstitution[]>([]);
  const [searchingRequestColleges, setSearchingRequestColleges] = useState(false);
  const [requestCollegeSearchError, setRequestCollegeSearchError] = useState("");
  const [requestExternalInstitutionId, setRequestExternalInstitutionId] = useState("");
  const [requestingInstitution, setRequestingInstitution] = useState(false);
  const [institutionRequestSent, setInstitutionRequestSent] = useState(false);
  const databaseInstitutionMatches = institutionSearch.trim().length >= 2
    ? institutions.filter((institution) => institution.name.toLowerCase().includes(institutionSearch.trim().toLowerCase())).slice(0, 12)
    : [];
  const institutionNotAvailable = institutionSearch.trim().length >= 2 && !loadingInstitutions && databaseInstitutionMatches.length === 0 && !institutionId;
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
    if (!(showInstitutionRequest || institutionNotAvailable) || indianStates.length > 0) return;
    const controller = new AbortController();
    setLoadingStates(true);
    setLocationLookupError("");
    fetch(`${API_BASE_URL}/api/guest/india/states`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || "Could not load Indian states.");
        setIndianStates(Array.isArray(data?.states) ? data.states : []);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setLocationLookupError(cause instanceof Error ? cause.message : "Could not load Indian states.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingStates(false); });
    return () => controller.abort();
  }, [showInstitutionRequest, institutionNotAvailable, indianStates.length]);

  useEffect(() => {
    if (!requestState || !(showInstitutionRequest || institutionNotAvailable)) {
      setIndianCities([]);
      setRequestCity("");
      return;
    }
    const controller = new AbortController();
    setLoadingCities(true);
    setLocationLookupError("");
    fetch(`${API_BASE_URL}/api/guest/india/cities?state=${encodeURIComponent(requestState)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || "Could not load cities for this state.");
        setIndianCities(Array.isArray(data?.cities) ? data.cities : []);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setLocationLookupError(cause instanceof Error ? cause.message : "Could not load cities.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingCities(false); });
    return () => controller.abort();
  }, [requestState, showInstitutionRequest, institutionNotAvailable]);

  useEffect(() => {
    const query = collegeName.trim();
    if (!(showInstitutionRequest || institutionNotAvailable) || query.length < 2 || institutionRequestSent) {
      setRequestCollegeMatches([]);
      setRequestCollegeSearchError("");
      setSearchingRequestColleges(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearchingRequestColleges(true);
        setRequestCollegeSearchError("");
        const response = await fetch(`${API_BASE_URL}/api/guest/institution-search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || "Could not search colleges.");
        setRequestCollegeMatches(Array.isArray(data?.institutions) ? data.institutions : []);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setRequestCollegeMatches([]);
          setRequestCollegeSearchError(cause instanceof Error ? cause.message : "Could not search colleges.");
        }
      } finally {
        if (!controller.signal.aborted) setSearchingRequestColleges(false);
      }
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [collegeName, showInstitutionRequest, institutionNotAvailable, institutionRequestSent]);



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
    if (collegeName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestEmail.trim()) || !requestState || !requestCity) {
      setInstitutionRequestError("Enter a valid email address and choose a college name, state and city.");
      return;
    }
    try {
      setRequestingInstitution(true);
      setInstitutionRequestError("");
      const response = await fetch(`${API_BASE_URL}/api/guest/institution-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeName: collegeName.trim(), email: requestEmail.trim(), locality: `${requestCity}, ${requestState}, India`, guestId, externalInstitutionId: requestExternalInstitutionId }),
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
    if (step !== 2 || !institutionId) {
      setError("Select your institution from the Gradly database. If it is missing, request that it be added.");
      return;
    }
    try {
      setError("");
      setStartingGuest(true);
      const response = await fetch(`${API_BASE_URL}/api/guest/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: guestId.trim().toUpperCase(), institutionId }),
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
              <div className="guest-live-institution-search">
                <label htmlFor="guest-institution-search">Search your college / university</label>
                <input id="guest-institution-search" value={institutionSearch} onChange={(event) => {
                  const query = event.target.value;
                  setInstitutionSearch(query);
                  setInstitutionId("");
                  setCollegeName(query);
                  setRequestExternalInstitutionId("");
                  setError("");
                  setInstitutionRequestError("");
                  setShowInstitutionRequest(false);
                }} maxLength={100} placeholder="Start typing your college name…" autoComplete="off" disabled={startingGuest} />
                <small className="guest-setup-form__hint">Searches colleges already listed in Gradly.</small>
                {loadingInstitutions && <small className="guest-live-search-status">Loading Gradly’s college directory…</small>}
                {!loadingInstitutions && institutionSearch.trim().length >= 2 && databaseInstitutionMatches.length > 0 && (
                  <div className="guest-live-institution-results" role="listbox" aria-label="Gradly college results">
                    {databaseInstitutionMatches.map((institution) => (
                      <button key={institution.id} type="button" role="option" aria-selected={institutionId === institution.id} onClick={() => {
                        setInstitutionId(institution.id);
                        setInstitutionSearch(institution.name);
                        setCollegeName(institution.name);
                        setShowInstitutionRequest(false);
                        setError("");
                      }}>
                        <strong>{institution.name}</strong>
                        <span>{institutionId === institution.id ? "Selected from Gradly database" : "Available in Gradly"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {institutionId && <div className="guest-live-institution-selected"><span>COLLEGE SELECTED</span><strong>{institutionSearch}</strong><small>This college is available in Gradly.</small></div>}
              </div>
              {institutionNotAvailable && <div className="guest-institution-missing" role="status"><span>Your college is currently not available in Gradly.</span><strong>Request the Super Admin to add it below.</strong></div>}
              {!institutionNotAvailable && !institutionId && <div className="guest-institution-missing"><span>Can’t find your college?</span><button type="button" onClick={() => { setShowInstitutionRequest((visible) => !visible); setInstitutionRequestError(""); }}>Request college addition</button></div>}
              {(showInstitutionRequest || institutionNotAvailable) && (
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
                      <input id="request-college-name" value={collegeName} onChange={(event) => { setCollegeName(event.target.value); setRequestExternalInstitutionId(""); }} maxLength={160} placeholder="Search college or enter its name…" autoComplete="organization" />
                      {searchingRequestColleges && <small className="guest-live-search-status">Searching colleges and universities online…</small>}
                      {requestCollegeSearchError && <small className="guest-live-search-error" role="status">{requestCollegeSearchError}</small>}
                      {requestCollegeMatches.length > 0 && !requestExternalInstitutionId && (
                        <div className="guest-live-institution-results guest-request-college-results" role="listbox" aria-label="College search results">
                          {requestCollegeMatches.map((institution) => (
                            <button key={institution.externalId} type="button" role="option" aria-selected="false" onClick={() => {
                              setCollegeName(institution.name);
                              setRequestExternalInstitutionId(institution.externalId);
                              const matchedState = indianStates.find((state) => state.toLowerCase() === institution.region.toLowerCase());
                              if (matchedState) setRequestState(matchedState);
                              if (institution.city) setRequestCity(institution.city);
                              setRequestCollegeMatches([]);
                              setInstitutionRequestError("");
                            }}>
                              <strong>{institution.name}</strong>
                              <span>{[institution.city, institution.region, institution.country].filter(Boolean).join(", ") || "Location not listed"}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <label htmlFor="request-college-email">Your email address</label>
                      <input id="request-college-email" type="email" value={requestEmail} onChange={(event) => { setRequestEmail(event.target.value); setInstitutionRequestError(""); }} maxLength={254} placeholder="you@example.com" autoComplete="email" required />
                      <small className="guest-setup-form__hint">We’ll use this email if the admin needs to follow up about your college request.</small>
                      <label htmlFor="request-college-state">State / Union Territory</label>
                      <select id="request-college-state" value={requestState} onChange={(event) => { setRequestState(event.target.value); setRequestCity(""); setInstitutionRequestError(""); }} disabled={loadingStates || requestingInstitution} required>
                        <option value="">{loadingStates ? "Loading Indian states…" : "Choose state / Union Territory"}</option>
                        {indianStates.map((state) => <option key={state} value={state}>{state}</option>)}
                      </select>
                      <label htmlFor="request-college-city">City</label>
                      <select id="request-college-city" value={requestCity} onChange={(event) => { setRequestCity(event.target.value); setInstitutionRequestError(""); }} disabled={!requestState || loadingCities || requestingInstitution} required>
                        <option value="">{!requestState ? "Choose a state first" : loadingCities ? "Loading cities…" : "Choose city"}</option>
                        {indianCities.map((city) => <option key={city} value={city}>{city}</option>)}
                      </select>
                      {locationLookupError && <small className="guest-live-search-error" role="status">{locationLookupError}</small>}
                      <div className="guest-institution-request__proforma">
                        <span>REQUEST PREVIEW</span>
                        <p><b>College:</b> {collegeName.trim() || "[College name]"}</p>
                        <p><b>Location:</b> {requestCity && requestState ? `${requestCity}, ${requestState}, India` : "[Choose state and city]"}</p>
                        <p><b>Guest ID:</b> {guestId}</p>
                        <p><b>Email:</b> {requestEmail.trim() || "[Your email address]"}</p>
                      </div>
                      <button className="guest-institution-request__submit" type="button" onClick={handleInstitutionRequest} disabled={requestingInstitution || loadingStates || loadingCities || !requestState || !requestCity || collegeName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestEmail.trim())}>
                        {requestingInstitution ? "Sending request…" : "Send request to admin"} <span>↗</span>
                      </button>
                      <small className="guest-setup-form__hint">This submits your request directly to the Super Admin inbox for review.</small>
                    </>
                  )}
                  {institutionRequestError && <p className="guest-setup-error" role="alert">{institutionRequestError}</p>}
                </section>
              )}
              <button className="guest-setup-form__submit" type="submit" disabled={startingGuest || loadingInstitutions || !institutionId}>{startingGuest ? "Creating workspace…" : "Enter Guest Mode"} <span>↗</span></button>
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
