import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  LockKeyhole,
  Megaphone,
  MessageSquare,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import "../../styles/super-admin-modules.css";

type ModuleInfo = {
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof Building2;
  status: string;
  scope: string;
  capabilities: string[];
  route: string;
};

const modules: Record<string, ModuleInfo> = {
  institutions: {
    title: "Institution Management",
    eyebrow: "ACADEMIC GOVERNANCE",
    description: "Manage the institutions that belong to the Gradly ecosystem and their academic structure.",
    icon: Building2,
    status: "Backend CRUD not yet exposed",
    scope: "Global institution registry",
    capabilities: ["Institution directory and profiles", "Programs and branches", "Institution onboarding requests", "Institution-admin assignments"],
    route: "/super-admin/institutions",
  },
  curriculum: {
    title: "Curriculum & Courses",
    eyebrow: "ACADEMIC GOVERNANCE",
    description: "Central oversight for courses, branches, subjects, syllabi and curriculum-change requests.",
    icon: BookOpen,
    status: "Request API not yet verified",
    scope: "Cross-institution curriculum",
    capabilities: ["Course and branch catalogue", "Semester and subject structure", "Syllabus revisions", "Curriculum change approvals"],
    route: "/super-admin/curriculum",
  },
  audit: {
    title: "Audit Logs",
    eyebrow: "SECURITY & COMPLIANCE",
    description: "A searchable record of administrative actions, access changes and sensitive platform events.",
    icon: Activity,
    status: "Dedicated audit endpoint not exposed",
    scope: "Platform-wide event trail",
    capabilities: ["Actor and action history", "Timestamped administrative events", "Security-relevant changes", "Search and date filtering"],
    route: "/super-admin/audit",
  },
  feedback: {
    title: "Feedback & Support",
    eyebrow: "SERVICE OPERATIONS",
    description: "Review student and administrator feedback and route unresolved items to the right team.",
    icon: MessageSquare,
    status: "Feedback API not yet verified",
    scope: "All supported users",
    capabilities: ["Feedback inbox", "Status and priority tracking", "Internal resolution notes", "Response and closure history"],
    route: "/super-admin/feedback",
  },
  settings: {
    title: "System Settings",
    eyebrow: "PLATFORM CONFIGURATION",
    description: "Central configuration for the ecosystem. Changes should be persisted and audited by the backend.",
    icon: Settings,
    status: "Settings API not exposed",
    scope: "Global configuration",
    capabilities: ["Platform identity and defaults", "Session and access policies", "Notification preferences", "Configuration change history"],
    route: "/super-admin/settings",
  },
  safety: {
    title: "Safety & Security",
    eyebrow: "TRUST & PROTECTION",
    description: "A central workspace for reviewing security events and taking carefully authorized action.",
    icon: ShieldAlert,
    status: "Safety actions API not exposed",
    scope: "Platform-wide safeguards",
    capabilities: ["Security event review", "Temporary account restrictions", "Suspicious activity triage", "Action reason and audit trail"],
    route: "/super-admin/safety",
  },
  announcements: {
    title: "Announcements",
    eyebrow: "PLATFORM COMMUNICATIONS",
    description: "Prepare and manage official notices for the audiences supported by Gradly.",
    icon: Megaphone,
    status: "Announcement API not exposed",
    scope: "Targeted ecosystem notices",
    capabilities: ["Draft and publish notices", "Audience targeting", "Scheduled announcements", "Published notice history"],
    route: "/super-admin/announcements",
  },
  "password-resets": {
    title: "Password Reset Requests",
    eyebrow: "ACCOUNT SUPPORT",
    description: "Review account recovery requests through a controlled, auditable workflow.",
    icon: LockKeyhole,
    status: "Reset-request API not exposed",
    scope: "Eligible user accounts",
    capabilities: ["Pending recovery requests", "Identity verification status", "Approve or reject with reason", "Resolution history"],
    route: "/super-admin/password-resets",
  },
  requests: {
    title: "Request Centre",
    eyebrow: "OPERATIONS",
    description: "A unified view for requests that need Super Admin review across the ecosystem.",
    icon: ClipboardList,
    status: "Unified request API not exposed",
    scope: "Cross-module request queues",
    capabilities: ["Institution requests", "Curriculum change requests", "Admin applications", "Account and support requests"],
    route: "/super-admin/requests",
  },
};

const quickLinks = [
  { label: "Dashboard", to: "/super-admin", icon: ArrowUpRight },
  { label: "Institutions", to: "/super-admin/institutions", icon: Building2 },
  { label: "Curriculum", to: "/super-admin/curriculum", icon: BookOpen },
  { label: "Audit logs", to: "/super-admin/audit", icon: FileText },
  { label: "Users & guests", to: "/super-admin/users", icon: Users },
  { label: "Administrators", to: "/super-admin/admins", icon: ShieldCheck },
  { label: "Applications", to: "/super-admin/applications", icon: ClipboardList },
  { label: "Feedback", to: "/super-admin/feedback", icon: MessageSquare },
  { label: "Announcements", to: "/super-admin/announcements", icon: Megaphone },
  { label: "Safety", to: "/super-admin/safety", icon: ShieldAlert },
  { label: "Password resets", to: "/super-admin/password-resets", icon: LockKeyhole },
  { label: "Settings", to: "/super-admin/settings", icon: Settings },
];

export default function SuperAdminModule() {
  const location = useLocation();
  const key = location.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const info = modules[key] ?? modules.requests;
  const Icon = info.icon;

  return (
    <main className="sam-page">
      <header className="sam-header">
        <div>
          <Link className="sam-back" to="/super-admin"><ArrowLeft size={15} /> Back to command centre</Link>
          <span className="sam-eyebrow">{info.eyebrow}</span>
          <h1>{info.title}</h1>
          <p>{info.description}</p>
        </div>
        <div className="sam-header-icon"><Icon size={27} /></div>
      </header>

      <section className="sam-status-card" aria-live="polite">
        <div className="sam-status-icon"><ShieldAlert size={20} /></div>
        <div className="sam-status-copy">
          <strong>Live management is not connected yet</strong>
          <p>This route is now separate and correctly reachable, but the repository does not currently expose a verified backend API for this module. No sample records or fake success actions are shown.</p>
          <span>{info.status}</span>
        </div>
        <span className="sam-status-pill">Integration required</span>
      </section>

      <section className="sam-overview">
        <div className="sam-section-heading">
          <div><span>MODULE SCOPE</span><h2>What belongs here</h2></div>
          <span className="sam-scope"><CheckCircle2 size={14} /> {info.scope}</span>
        </div>
        <div className="sam-capability-grid">
          {info.capabilities.map((item, index) => (
            <article className="sam-capability" key={item}>
              <span className="sam-capability-number">{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
              <span>Requires persisted API support</span>
            </article>
          ))}
        </div>
      </section>

      <section className="sam-navigation">
        <div className="sam-section-heading">
          <div><span>WORKSPACE</span><h2>Go to another section</h2></div>
        </div>
        <div className="sam-link-grid">
          {quickLinks.filter((link) => link.to !== info.route).map((link) => {
            const LinkIcon = link.icon;
            return <Link className="sam-workspace-link" to={link.to} key={link.to}>
              <span><LinkIcon size={17} /></span><strong>{link.label}</strong><ArrowUpRight size={15} />
            </Link>;
          })}
        </div>
      </section>

      <footer className="sam-footer">
        <span><LockKeyhole size={14} /> Protected Super Admin workspace</span>
        <span>Gradly Ecosystem · Administration</span>
      </footer>
    </main>
  );
}
