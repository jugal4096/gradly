import {
    Activity,
    ArrowUpRight,
    Box,
    Database,
    FileCode2,
    GitBranch,
    LayoutDashboard,
    LockKeyhole,
    Server,
    Settings,
    Shield,
    UserCog,
  } from "lucide-react";
  
  import "./EcosystemLayout.css";
  
  function EcosystemEntry() {
    const mainAppUrl =
      import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5174";
  
    return (
      <div className="dev-environment">
  
        {/* ─────────────────────────────────────────
            TOP BAR
        ───────────────────────────────────────── */}
  
        <header className="dev-topbar">
  
          <div className="dev-brand">
            <div className="dev-brand-icon">
              <img
                src="/gradly-ecosystem-logo.png"
                alt="Gradly"
              />
            </div>
  
            <div>
              <div className="dev-brand-name">
                Gradly
              </div>
  
              <div className="dev-brand-subtitle">
                Ecosystem
              </div>
            </div>
          </div>
  
  
          <div className="dev-breadcrumb">
            <span>ecosystem</span>
            <span>/</span>
            <strong>development</strong>
          </div>
  
  
          <div className="dev-environment-status">
            <span className="status-indicator" />
            Development
          </div>
  
        </header>
  
  
        {/* ─────────────────────────────────────────
            BODY
        ───────────────────────────────────────── */}
  
        <div className="dev-body">
  
          {/* SIDEBAR */}
  
          <aside className="dev-sidebar">
  
            <div className="sidebar-section">
  
              <div className="sidebar-title">
                PROJECT
              </div>
  
              <div className="sidebar-item active">
                <LayoutDashboard size={15} />
                Overview
              </div>
  
              <div className="sidebar-item">
                <Box size={15} />
                Environment
              </div>
  
              <div className="sidebar-item">
                <Server size={15} />
                Services
              </div>
  
              <div className="sidebar-item">
                <Activity size={15} />
                Activity
              </div>
  
            </div>
  
  
            <div className="sidebar-section">
  
              <div className="sidebar-title">
                ACCESS
              </div>
  
              <a
                href={mainAppUrl}
                className="sidebar-item"
              >
                <FileCode2 size={15} />
                Developer
              </a>
  
              <a
                href="/admin/login"
                className="sidebar-item"
              >
                <UserCog size={15} />
                Administrator
              </a>
  
              <a
                href="/super-admin/login"
                className="sidebar-item"
              >
                <Shield size={15} />
                Super Admin
              </a>
  
            </div>
  
  
            <div className="sidebar-section">
  
              <div className="sidebar-title">
                SYSTEM
              </div>
  
              <div className="sidebar-item">
                <GitBranch size={15} />
                Version
                <span className="sidebar-value">
                  v2
                </span>
              </div>
  
              <div className="sidebar-item">
                <Settings size={15} />
                Configuration
              </div>
  
            </div>
  
  
            <div className="sidebar-bottom">
  
              <div className="sidebar-bottom-label">
                Gradly Ecosystem
              </div>
  
              <div className="sidebar-bottom-version">
                Internal environment · 2.0.0
              </div>
  
            </div>
  
          </aside>
  
  
          {/* MAIN CONTENT */}
  
          <main className="dev-content">
  
            {/* PAGE HEADER */}
  
            <div className="dev-page-header">
  
              <div>
  
                <div className="dev-page-kicker">
                  PROJECT / OVERVIEW
                </div>
  
                <h1>
                  Gradly Ecosystem
                </h1>
  
                <p>
                  Internal development environment for the Gradly platform.
                </p>
  
              </div>
  
              <div className="dev-page-meta">
                <span className="meta-label">
                  ENVIRONMENT
                </span>
  
                <span className="meta-value">
                  development
                </span>
              </div>
  
            </div>
  
  
            {/* LOGO / PROJECT PANEL */}
  
            <section className="project-panel">
  
              <div className="panel-header">
  
                <div>
                  <div className="panel-title">
                    Project
                  </div>
  
                  <div className="panel-subtitle">
                    Gradly platform ecosystem
                  </div>
                </div>
  
                <span className="panel-status">
                  Internal
                </span>
  
              </div>
  
  
              <div className="project-identity">
  
                <div className="project-logo">
  
                  <img
                    src="/gradly-ecosystem-logo.png"
                    alt="Gradly Ecosystem"
                  />
  
                </div>
  
                <div className="project-identity-text">
  
                  <h2>
                    Gradly Ecosystem
                  </h2>
  
                  <p>
                    Shared internal environment connecting
                    application, administration and governance
                    layers.
                  </p>
  
                  <div className="project-tags">
                    <span>React</span>
                    <span>Node.js</span>
                    <span>PostgreSQL</span>
                    <span>Firebase Auth</span>
                  </div>
  
                </div>
  
              </div>
  
            </section>
  
  
            {/* ACCESS */}
  
            <section className="section-block">
  
              <div className="section-heading">
  
                <div>
                  <h2>
                    Access
                  </h2>
  
                  <p>
                    Choose the environment you want to enter.
                  </p>
                </div>
  
              </div>
  
  
              <div className="access-grid">
  
                <a
                  href={mainAppUrl}
                  className="access-card developer"
                >
  
                  <div className="access-card-top">
  
                    <div className="access-card-icon">
                      <FileCode2 size={18} />
                    </div>
  
                    <ArrowUpRight
                      size={16}
                      className="access-arrow"
                    />
  
                  </div>
  
                  <div className="access-card-title">
                    Developer
                  </div>
  
                  <div className="access-card-description">
                    Open the main Gradly application.
                  </div>
  
                  <div className="access-card-footer">
                    Main Application
                  </div>
  
                </a>
  
  
                <a
                  href="/admin/login"
                  className="access-card administrator"
                >
  
                  <div className="access-card-top">
  
                    <div className="access-card-icon">
                      <UserCog size={18} />
                    </div>
  
                    <ArrowUpRight
                      size={16}
                      className="access-arrow"
                    />
  
                  </div>
  
                  <div className="access-card-title">
                    Administrator
                  </div>
  
                  <div className="access-card-description">
                    Manage department-level academic operations.
                  </div>
  
                  <div className="access-card-footer">
                    Admin Portal
                  </div>
  
                </a>
  
  
                <a
                  href="/super-admin/login"
                  className="access-card super-admin"
                >
  
                  <div className="access-card-top">
  
                    <div className="access-card-icon">
                      <LockKeyhole size={18} />
                    </div>
  
                    <ArrowUpRight
                      size={16}
                      className="access-arrow"
                    />
  
                  </div>
  
                  <div className="access-card-title">
                    Super Admin
                  </div>
  
                  <div className="access-card-description">
                    Central governance and system controls.
                  </div>
  
                  <div className="access-card-footer">
                    Control Center
                  </div>
  
                </a>
  
              </div>
  
            </section>
  
  
            {/* SERVICES */}
  
            <section className="section-block">
  
              <div className="section-heading">
  
                <div>
                  <h2>
                    Services
                  </h2>
  
                  <p>
                    Current development environment status.
                  </p>
                </div>
  
              </div>
  
  
              <div className="services-table">
  
                <div className="service-row">
  
                  <div className="service-name">
                    <span className="service-icon purple">
                      <Server size={15} />
                    </span>
  
                    Gradly API
                  </div>
  
                  <div className="service-type">
                    Node.js / Express
                  </div>
  
                  <div className="service-status">
                    <span />
                    Operational
                  </div>
  
                </div>
  
  
                <div className="service-row">
  
                  <div className="service-name">
                    <span className="service-icon blue">
                      <Database size={15} />
                    </span>
  
                    PostgreSQL
                  </div>
  
                  <div className="service-type">
                    Supabase
                  </div>
  
                  <div className="service-status">
                    <span />
                    Connected
                  </div>
  
                </div>
  
  
                <div className="service-row">
  
                  <div className="service-name">
                    <span className="service-icon green">
                      <Shield size={15} />
                    </span>
  
                    Authentication
                  </div>
  
                  <div className="service-type">
                    Firebase Auth
                  </div>
  
                  <div className="service-status">
                    <span />
                    Ready
                  </div>
  
                </div>
  
              </div>
  
            </section>
  
  
            {/* DEVELOPMENT NOTE */}
  
            <div className="development-note">
  
              <div className="development-note-icon">
                <GitBranch size={15} />
              </div>
  
              <div>
  
                <strong>
                  Development environment
                </strong>
  
                <p>
                  This environment is used for internal development,
                  administration and system-level operations.
                </p>
  
              </div>
  
            </div>
  
          </main>
  
        </div>
  
  
        {/* FOOTER */}
  
        <footer className="dev-footer">
  
          <span>
            Gradly Ecosystem
          </span>
  
          <span>
            Internal development environment
          </span>
  
          <span>
            v2.0.0
          </span>
  
        </footer>
  
      </div>
    );
  }
  
  export default EcosystemEntry;