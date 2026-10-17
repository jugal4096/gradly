import {
  ArrowRight,
  Monitor,
  Settings,
  Shield,
} from "lucide-react";

import "./EcosystemEntry.css";

function EcosystemEntry() {
  const mainAppUrl =
    import.meta.env.VITE_MAIN_APP_URL ||
    "http://localhost:5174";

  return (
    <main className="system-page">

      {/* TOP BAR */}
      <header className="system-bar">

        <div className="system-brand">
          <span className="system-led" />
          <span>GRADLY ECOSYSTEM</span>
        </div>

        <div className="system-bar-right">
          <span>INTERNAL SYSTEM</span>

          <span className="bar-divider" />

          <span className="ready-text">
            READY
          </span>
        </div>

      </header>


      {/* MAIN WORKSPACE */}
      <section className="system-workspace">

        {/* LOGO + TITLE */}
        <div className="system-identity">

          <div className="identity-logo">
            <img
              src="/gradly-ecosystem-logo.png"
              alt="Gradly Ecosystem"
            />
          </div>

          <div className="identity-text">

            <div className="system-code">
              SYSTEM / GRADLY-ECOSYSTEM
            </div>

            <h1>
              Gradly Ecosystem
            </h1>

            <h2>
              Development and Administration System
            </h2>

          </div>

        </div>


        {/* INTERFACE TITLE */}
        <div className="system-divider">

          <span>
            SELECT SYSTEM INTERFACE
          </span>

          <div />

        </div>


        {/* INTERFACE MODULES */}
        <div className="interface-grid">

          {/* USER */}
          <a
            href={mainAppUrl}
            className="interface-module user-module"
          >

            <div className="module-icon">
              <Monitor
                size={32}
                strokeWidth={1.8}
              />
            </div>

            <div className="module-content">

              <span className="module-number">
                01 / USER
              </span>

              <h3>
                Continue as User
              </h3>

              <p>
                Enter the main Gradly application
                and access academic services.
              </p>

            </div>

            <div className="continue-button">

              <span>
                CONTINUE AS USER
              </span>

              <ArrowRight size={18} />

            </div>

          </a>


          {/* ADMIN */}
          <a
            href="/admin/login"
            className="interface-module admin-module"
          >

            <div className="module-icon">
              <Settings
                size={32}
                strokeWidth={1.8}
              />
            </div>

            <div className="module-content">

              <span className="module-number">
                02 / ADMIN
              </span>

              <h3>
                Continue as Admin
              </h3>

              <p>
                Manage academic operations,
                departments and requests.
              </p>

            </div>

            <div className="continue-button">

              <span>
                CONTINUE AS ADMIN
              </span>

              <ArrowRight size={18} />

            </div>

          </a>


          {/* SUPER ADMIN */}
          <a
            href="/super-admin/login"
            className="interface-module super-module"
          >

            <div className="module-icon">
              <Shield
                size={32}
                strokeWidth={1.8}
              />
            </div>

            <div className="module-content">

              <span className="module-number">
                03 / SYSTEM
              </span>

              <h3>
                Continue as Super Admin
              </h3>

              <p>
                Control system configuration,
                governance and administration.
              </p>

            </div>

            <div className="continue-button">

              <span>
                CONTINUE AS SUPER ADMIN
              </span>

              <ArrowRight size={18} />

            </div>

          </a>

        </div>


        {/* SYSTEM STATUS */}
        <div className="diagnostic-bar">

          <div>
            <span className="diagnostic-label">
              MODE
            </span>

            <strong>
              INTERNAL
            </strong>
          </div>

          <div className="diagnostic-separator" />

          <div>
            <span className="diagnostic-label">
              CONNECTION
            </span>

            <strong className="connection">
              ● ACTIVE
            </strong>
          </div>

          <div className="diagnostic-separator" />

          <div>
            <span className="diagnostic-label">
              ACCESS
            </span>

            <strong>
              CONTROLLED
            </strong>
          </div>

        </div>

      </section>


      {/* FOOTER */}
      <footer className="system-footer">

        <span>
          GRADLY SOFTWARE SYSTEM
        </span>

        <span>
          © INTERNAL ENVIRONMENT
        </span>

      </footer>

    </main>
  );
}

export default EcosystemEntry;