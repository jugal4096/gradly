import { Link } from "react-router-dom";
import "./legal-pages.css";

type LegalPageProps = { type: "terms" | "privacy" };

export default function LegalPage({ type }: LegalPageProps) {
  const isTerms = type === "terms";
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" to="/">gradly<span>.</span></Link>
        <Link className="legal-back" to="/">← Back to Gradly</Link>
      </header>
      <article className="legal-document">
        <p className="legal-eyebrow">GRADLY · LEGAL</p>
        <h1>{isTerms ? "Terms of Service" : "Privacy Policy"}</h1>
        <p className="legal-updated">Draft for review · 15 November 2026</p>
        {isTerms ? <TermsContent /> : <PrivacyContent />}
        <nav className="legal-switch" aria-label="Other legal document">
          <Link to={isTerms ? "/privacy" : "/terms"}>{isTerms ? "Read our Privacy Policy →" : "Read our Terms of Service →"}</Link>
        </nav>
      </article>
      <footer className="legal-footer"><span>© {new Date().getFullYear()} Gradly</span><Link to="/">Return to welcome page</Link></footer>
    </main>
  );
}

function TermsContent() {
  return <>
    <p>These Terms of Service explain the conditions for accessing and using Gradly. By continuing into Gradly, you confirm that you have read these terms and agree to follow them. If you do not agree, do not use the service.</p>
    <h2>1. About Gradly</h2>
    <p>Gradly is an academic companion platform designed to help students organise academic information, calculate and understand grade-related metrics, plan academic goals, and use the tools made available within the student platform. Features may change as the service develops.</p>
    <h2>2. Eligibility and accounts</h2>
    <p>You must be legally capable of accepting these terms under the laws applicable to you. Some features require signing in with a supported account. You are responsible for keeping access to your account secure and for activity carried out through your signed-in session. Information submitted during academic setup should be accurate and relate to you.</p>
    <h2>3. Guest access</h2>
    <p>Gradly may provide a guest mode that allows access to a limited set of tools without creating or signing in to an account. Guest access may use browser or session storage to maintain the guest experience. Guest data may not synchronise across devices and may be lost when browser data is cleared.</p>
    <h2>4. Academic information and calculations</h2>
    <p>Calculations, projections, planners, summaries and other academic insights are provided as assistance tools. Their accuracy depends on the information entered, selected or made available to Gradly. You should review subject names, credits, grades, grading rules and other inputs before relying on a calculation.</p>
    <p>Gradly is not your university, examination authority or official result publisher. Any result or academic record displayed through Gradly should be checked against the official record issued by your institution. In the event of a difference, the institution's official record and applicable academic regulations prevail.</p>
    <h2>5. Result retrieval and third-party services</h2>
    <p>Where available, Gradly may help retrieve or process academic result information from institutional or other supported sources. Availability, format and reliability of those sources are outside Gradly's control. Automated retrieval may be unavailable, delayed, incomplete or require correction. You remain responsible for verifying retrieved information.</p>
    <p>Gradly may rely on third-party services for functions such as authentication, hosting, storage or delivery. Your use of those functions may also be subject to the relevant third party's terms and policies.</p>
    <h2>6. Acceptable use</h2>
    <p>You agree not to misuse Gradly, interfere with its operation, attempt to access accounts or data without permission, introduce malicious code, probe or bypass security controls, scrape or overload the service, impersonate another person, or use the platform for unlawful, abusive or infringing activity.</p>
    <p>You must not submit content that violates another person's rights or applicable law. If community or contribution features are available, you are responsible for the content you post and must treat other users respectfully.</p>
    <h2>7. Your content and intellectual property</h2>
    <p>You retain rights you already hold in information and content you submit. You give Gradly permission to process that content as reasonably necessary to operate the features you choose to use. Gradly and its licensors retain rights in the platform, software, design, branding and original materials. These terms do not transfer ownership of either party's intellectual property.</p>
    <h2>8. Availability and changes</h2>
    <p>We may add, change, suspend or discontinue features to maintain, improve or protect the service. We aim to keep Gradly useful and available, but do not promise uninterrupted or error-free operation. Maintenance, outages, institutional website changes and events outside our reasonable control may affect access.</p>
    <h2>9. Suspension and termination</h2>
    <p>Access may be restricted or suspended where reasonably necessary to protect users, the platform or third parties, address suspected misuse, comply with law, or enforce these terms. You may stop using Gradly at any time. Account and data-related requests are handled under the Privacy Policy and applicable law.</p>
    <h2>10. Disclaimers and limitation of liability</h2>
    <p>To the extent permitted by applicable law, Gradly is provided on an as-available basis and does not guarantee that every feature, calculation, integration or retrieved record will be uninterrupted, complete or error-free. Nothing in these terms excludes a right or remedy that cannot lawfully be excluded.</p>
    <p>To the extent permitted by law, Gradly will not be responsible for indirect or consequential loss arising from reliance on an unverified calculation, projection, retrieved result or third-party service. This does not limit liability where such limitation is prohibited by applicable law, including liability that cannot legally be excluded.</p>
    <h2>11. Privacy</h2>
    <p>Our Privacy Policy explains how information is handled when you use Gradly. It should be read alongside these terms.</p>
    <h2>12. Changes to these terms</h2>
    <p>We may revise these terms as Gradly or applicable requirements change. The updated version will be published on this page with a revised effective date. Where a change materially affects users, we will take reasonable steps to draw attention to it. Continued use after updated terms take effect means you accept them, to the extent permitted by law.</p>
    <h2>13. Governing law and contact</h2>
    <p>These terms are subject to applicable laws of India. Any dispute will be handled by the courts or authorities having jurisdiction under applicable law. For questions, support or grievances, use the official Gradly contact channel published within the platform. A monitored support and grievance contact must be added and verified by the operator before public launch.</p>
  </>;
}

function PrivacyContent() {
  return <>
    <p>This Privacy Policy describes the categories of information that may be processed when you use Gradly, why that information is needed, and the choices available to you. The final policy should be read together with the actual services and data practices active in the published version of Gradly.</p>
    <h2>1. Information you provide</h2>
    <p>Depending on the features you use, information may include your name and email address supplied through sign-in, institution and academic profile details, programme, branch, scheme, semester, enrollment-related information, subject selections, credits, grades, academic results, planner entries, and content you choose to submit to community or support features.</p>
    <h2>2. Sign-in and authentication</h2>
    <p>If you choose Google sign-in, Gradly uses authentication information made available through the sign-in process to identify your account and provide access to your student workspace. Authentication is supported by third-party infrastructure. Google's own processing is also governed by Google's privacy information and applicable terms.</p>
    <h2>3. Guest mode</h2>
    <p>If you continue as a guest, Gradly uses browser session or local storage for guest access and information needed by guest tools. Guest information may remain on the device or browser where it was entered and may be removed when site data is cleared. Avoid using guest mode on a shared device if you do not want the next user of that browser to see locally retained information.</p>
    <h2>4. Technical and usage information</h2>
    <p>Technical information may be processed to operate, secure and troubleshoot the service. Depending on the infrastructure in use, this may include browser and device details, network information, diagnostic events, and error information generated during use. The operator should confirm the precise logs, analytics and telemetry enabled in production before publishing this policy.</p>
    <h2>5. How information is used</h2>
    <p>Information may be used to authenticate users, create and maintain academic profiles, perform grade and credit calculations, support progress tracking and planning, retrieve or reconcile result information where that feature is enabled, provide community and support functions, maintain platform security, investigate errors, prevent misuse, and improve reliability.</p>
    <h2>6. Result processing</h2>
    <p>When you use result retrieval or related academic features, information needed to identify and process the relevant academic record may be used for that purpose. Retrieved information may be parsed, compared with your academic profile and presented for your review. You should verify the result against your institution's official publication.</p>
    <h2>7. Sharing and service providers</h2>
    <p>Gradly may use service providers for authentication, application hosting, database or file storage, delivery, security and technical operations. Before publication, the operator should identify the actual providers, their roles, relevant processing locations and any applicable cross-border transfers in this section. Information may also be disclosed where required by law or valid legal process, or where reasonably necessary to protect users and the service.</p>
    <p>If a feature visibly shares information with other users, the information you choose to post may be visible according to that feature's design. The platform should explain any public profile, community visibility or administrator access in the context of the actual feature.</p>
    <h2>8. Storage and security</h2>
    <p>Information may be stored in the systems used to operate Gradly and, for guest tools, in your browser or device storage. Appropriate technical and organisational safeguards should be maintained to protect information. No online service or storage method can be guaranteed completely secure.</p>
    <h2>9. Retention and deletion</h2>
    <p>Information should be retained only for as long as reasonably necessary for the purposes described in this policy, applicable legal requirements, dispute resolution and platform security. The operator must define and publish actual retention periods or criteria for account data, academic records, logs, support records and backups. Clearing browser storage can remove guest information stored on that device, but does not itself delete information already submitted to platform systems.</p>
    <h2>10. Your choices and rights</h2>
    <p>Depending on applicable law, you may have rights to request access to information, seek correction or erasure, withdraw consent where processing is based on consent, and raise a grievance. You may also stop using the service or choose guest access instead of signing in. Some features will not work without the information they require. Requests should be handled through the verified contact channel published by Gradly.</p>
    <h2>11. Children</h2>
    <p>Gradly is intended for students who are legally permitted to use the service. The operator should implement and describe any age-related safeguards required by applicable law. A parent or guardian who has a concern about a child's information should be able to contact Gradly through the official support channel.</p>
    <h2>12. Changes to this policy</h2>
    <p>This policy may be updated as features, service providers or legal requirements change. The latest version and effective date will be displayed on this page. Material changes should be communicated through an appropriate platform notice where required.</p>
    <h2>13. Contact and grievances</h2>
    <p>For privacy questions, requests or grievances, use the official Gradly contact channel published within the platform. Before public launch, the operator must add a monitored privacy/grievance email or other reliable contact method, identify the responsible person where legally required, and confirm the applicable response process and timelines.</p>
  </>;
}
