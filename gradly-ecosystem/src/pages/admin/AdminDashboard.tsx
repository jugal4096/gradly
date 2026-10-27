import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

type ModuleItem = {
  id: string;
  title: string;
  description: string;
  category: "Academics" | "Workflow" | "Support";
  icon: typeof BookOpen;
  details: string[];
};

const modules: ModuleItem[] = [
  {
    id: "curriculum",
    title: "Curriculum & subjects",
    description: "Browse assigned academic data and subjects semester-wise.",
    category: "Academics",
    icon: BookOpen,
    details: [
      "View the academic schemes available to your assigned scope.",
      "Browse subjects by semester and inspect their credits.",
      "Submit a change request to the Super Admin when information needs updating.",
    ],
  },
  {
    id: "semesters",
    title: "Semesters & schemes",
    description: "Explore the academic structure relevant to your department.",
    category: "Academics",
    icon: CalendarDays,
    details: [
      "Review available schemes and semester structures.",
      "Use academic information for department-level coordination.",
      "Request additions or corrections through the approval workflow.",
    ],
  },
  {
    id: "requests",
    title: "Change requests",
    description: "Prepare and track requests for academic data changes.",
    category: "Workflow",
    icon: ClipboardList,
    details: [
      "Request a subject addition, removal or modification.",
      "Include the requested name, credits and reason for the change.",
      "The Super Admin remains responsible for approving system-wide changes.",
    ],
  },
  {
    id: "feedback",
    title: "Feedback & support",
    description: "Keep track of feedback and issues within your assigned scope.",
    category: "Support",
    icon: MessageSquare,
    details: [
      "Organise academic issues before escalating them.",
      "Keep relevant details ready when submitting a support request.",
      "Access is limited to the features enabled for your administrator account.",
    ],
  },
  {
    id: "reports",
    title: "Academic overview",
    description: "Get a clear starting point for day-to-day academic operations.",
    category: "Academics",
    icon: GraduationCap,
    details: [
      "Use the dashboard as a shortcut to your academic workflows.",
      "Check the assigned scope before making a request.",
      "Dashboard totals will appear when a supported statistics API is connected.",
    ],
  },
  {
    id: "activity",
    title: "Recent activity",
    description: "A quick place to review the latest workflow updates.",
    category: "Workflow",
    icon: Activity,
    details: [
      "Review updates surfaced by the connected application.",
      "Use request status and timestamps to follow up on pending work.",
      "This preview does not fabricate activity records when no live feed is available.",
    ],
  },
];

const filters = ["All modules", "Academics", "Workflow", "Support"] as const;
type Filter = (typeof filters)[number];

function AdminDashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All modules");
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    return modules.filter((item) => {
      const matchesFilter = filter === "All modules" || item.category === filter;
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [search, filter]);

  const handleLogout = () => {
    localStorage.removeItem("gradly_admin_token");
    navigate("/admin", { replace: true });
  };

  return (
    <div className="admin-dashboard">
      <aside className={`ad-sidebar ${menuOpen ? "ad-sidebar-open" : ""}`}>
        <button className="ad-brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="ad-brand-mark">G</span>
          <span className="ad-brand-copy">
            <strong>GRADLY</strong>
            <small>ADMIN PORTAL</small>
          </span>
        </button>

        <div className="ad-sidebar-label">WORKSPACE</div>
        <nav className="ad-sidebar-nav" aria-label="Admin navigation">
          <a className="ad-nav-link active" href="#admin-dashboard-top" onClick={() => setMenuOpen(false)}>
            <LayoutDashboard size={18} /> <span>Overview</span>
          </a>
          <a className="ad-nav-link" href="#admin-modules" onClick={() => setMenuOpen(false)}>
            <BookOpen size={18} /> <span>Academic modules</span>
          </a>
          <a className="ad-nav-link" href="#admin-workflows" onClick={() => setMenuOpen(false)}>
            <ClipboardList size={18} /> <span>Workflows</span>
          </a>
          <a className="ad-nav-link" href="#admin-help" onClick={() => setMenuOpen(false)}>
            <MessageSquare size={18} /> <span>Help & support</span>
          </a>
        </nav>

        <div className="ad-sidebar-bottom">
          <div className="ad-secure-card">
            <span className="ad-secure-icon"><ShieldCheck size={18} /></span>
            <span><strong>Role-protected</strong><small>Administrator access</small></span>
          </div>
          <button type="button" className="ad-logout" onClick={handleLogout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      {menuOpen && <button className="ad-sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <div className="ad-main-column">
        <header className="ad-topbar">
          <button type="button" className="ad-mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="ad-breadcrumb"><span>Gradly</span><span className="ad-breadcrumb-slash">/</span><strong>Admin workspace</strong></div>
          <div className="ad-topbar-right">
            <span className="ad-live-dot" />
            <span>Secure session</span>
            <span className="ad-avatar">A</span>
          </div>
        </header>

        <main className="ad-content" id="admin-dashboard-top">
          <section className="ad-hero">
            <div className="ad-hero-glow" aria-hidden="true" />
            <div className="ad-hero-content">
              <span className="ad-eyebrow"><Sparkles size={14} /> YOUR ACADEMIC WORKSPACE</span>
              <h1>Make academic operations <span>feel simpler.</span></h1>
              <p>Manage your assigned academic workflows, organise requests, and keep the important work moving.</p>
              <a className="ad-primary-action" href="#admin-modules">Explore workspace <ArrowRight size={17} /></a>
            </div>
            <div className="ad-hero-art" aria-hidden="true">
              <div className="ad-art-ring ad-art-ring-one" />
              <div className="ad-art-ring ad-art-ring-two" />
              <div className="ad-art-card">
                <div className="ad-art-card-head"><span className="ad-art-icon"><GraduationCap size={21} /></span><span className="ad-art-check"><CheckCircle2 size={17} /></span></div>
                <strong>Academic workspace</strong>
                <span className="ad-art-line ad-art-line-long" />
                <span className="ad-art-line" />
                <div className="ad-art-bars"><i /><i /><i /><i /><i /><i /><i /></div>
                <small>Organised · Connected · Secure</small>
              </div>
              <span className="ad-art-float ad-art-float-one"><BookOpen size={18} /></span>
              <span className="ad-art-float ad-art-float-two"><CheckCircle2 size={18} /></span>
            </div>
          </section>

          <section className="ad-metric-grid" aria-label="Dashboard status">
            <article className="ad-metric-card">
              <span className="ad-metric-icon mint"><BookOpen size={20} /></span>
              <span className="ad-metric-label">Academic modules</span>
              <strong>{modules.filter((item) => item.category === "Academics").length.toString().padStart(2, "0")}</strong>
              <span className="ad-metric-note">Available workspace shortcuts</span>
            </article>
            <article className="ad-metric-card">
              <span className="ad-metric-icon sage"><ClipboardList size={20} /></span>
              <span className="ad-metric-label">Request workflow</span>
              <strong>Ready</strong>
              <span className="ad-metric-note">Submit changes for approval</span>
            </article>
            <article className="ad-metric-card">
              <span className="ad-metric-icon pale"><ShieldCheck size={20} /></span>
              <span className="ad-metric-label">Access level</span>
              <strong>Admin</strong>
              <span className="ad-metric-note">Scoped to assigned privileges</span>
            </article>
          </section>

          <section className="ad-section" id="admin-modules">
            <div className="ad-section-heading">
              <div>
                <span className="ad-section-kicker">GET THINGS DONE</span>
                <h2>Your workspace</h2>
                <p>Choose a module to see what you can do from here.</p>
              </div>
              <span className="ad-module-count">{visibleModules.length} modules</span>
            </div>

            <div className="ad-module-toolbar">
              <label className="ad-search">
                <Search size={18} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search modules..." aria-label="Search modules" />
                {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}
              </label>
              <div className="ad-filter-tabs" role="group" aria-label="Filter modules">
                {filters.map((item) => (
                  <button key={item} type="button" className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>
                ))}
              </div>
            </div>

            <div className="ad-module-grid">
              {visibleModules.map((item) => {
                const Icon = item.icon;
                return (
                  <button type="button" key={item.id} className="ad-module-card" onClick={() => setSelectedModule(item)}>
                    <span className="ad-module-icon"><Icon size={21} /></span>
                    <span className="ad-module-category">{item.category}</span>
                    <strong>{item.title}</strong>
                    <span className="ad-module-description">{item.description}</span>
                    <span className="ad-module-open">Explore module <ArrowRight size={15} /></span>
                  </button>
                );
              })}
              {visibleModules.length === 0 && (
                <div className="ad-empty-state"><Search size={24} /><strong>No matching modules</strong><span>Try another search or choose a different filter.</span><button type="button" onClick={() => { setSearch(""); setFilter("All modules"); }}>Clear filters</button></div>
              )}
            </div>
          </section>

          <section className="ad-lower-grid" id="admin-workflows">
            <article className="ad-request-panel">
              <div className="ad-panel-icon"><FileText size={21} /></div>
              <div className="ad-panel-copy">
                <span className="ad-section-kicker">ACADEMIC GOVERNANCE</span>
                <h2>Need to change a subject?</h2>
                <p>Submit a request to add, remove, or update a subject or its credits. The Super Admin reviews and approves system-level changes.</p>
                <button type="button" className="ad-text-action" onClick={() => setSelectedModule(modules.find((item) => item.id === "requests") ?? null)}>Understand the request process <ArrowRight size={16} /></button>
              </div>
              <div className="ad-panel-decoration" aria-hidden="true"><ClipboardList size={62} /></div>
            </article>
            <article className="ad-help-panel" id="admin-help">
              <span className="ad-help-icon"><MessageSquare size={20} /></span>
              <span className="ad-section-kicker">HERE TO HELP</span>
              <h2>Keep your workflow clear.</h2>
              <p>Use the search and filters to find the right workspace quickly.</p>
              <button type="button" className="ad-help-refresh" onClick={() => { setSearch(""); setFilter("All modules"); setSelectedModule(null); }}><RefreshCw size={15} /> Reset workspace view</button>
            </article>
          </section>

          <footer className="ad-footer">
            <span><span className="ad-footer-mark">G</span> Gradly Ecosystem</span>
            <span><ShieldCheck size={14} /> Administrator workspace · Role-based access</span>
          </footer>
        </main>
      </div>

      {selectedModule && (
        <div className="ad-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedModule(null); }}>
          <section className="ad-modal" role="dialog" aria-modal="true" aria-labelledby="ad-modal-title">
            <div className="ad-modal-top">
              <span className="ad-modal-icon">{(() => { const Icon = selectedModule.icon; return <Icon size={23} />; })()}</span>
              <button type="button" className="ad-modal-close" aria-label="Close module details" onClick={() => setSelectedModule(null)}><X size={19} /></button>
            </div>
            <span className="ad-section-kicker">{selectedModule.category.toUpperCase()}</span>
            <h2 id="ad-modal-title">{selectedModule.title}</h2>
            <p className="ad-modal-description">{selectedModule.description}</p>
            <ul>{selectedModule.details.map((detail) => <li key={detail}><CheckCircle2 size={17} /><span>{detail}</span></li>)}</ul>
            <div className="ad-modal-note"><ShieldCheck size={17} /><span>Actions are governed by your assigned administrator permissions. This dashboard does not grant Super Admin capabilities.</span></div>
            <button type="button" className="ad-modal-done" onClick={() => setSelectedModule(null)}>Got it</button>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
