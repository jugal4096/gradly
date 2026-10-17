import {
    ArrowRight,
    FilePlus2,
    LogIn,
    ShieldCheck,
  } from "lucide-react";
  import { useNavigate } from "react-router-dom";
  
  import "./AdminPortal.css";
  
  function AdminPortal() {
    const navigate = useNavigate();
  
    return (
      <div className="admin-portal">
        <div className="admin-portal-shell">
  
          {/* HEADER */}
          <header className="admin-portal-header">
            <div className="admin-portal-brand">
              <div className="admin-portal-logo">G</div>
  
              <div>
                <div className="admin-portal-brand-name">
                  GRADLY
                </div>
  
                <div className="admin-portal-brand-subtitle">
                  Administration System
                </div>
              </div>
            </div>
  
            <div className="admin-portal-status">
              <span className="admin-status-dot" />
              ADMIN PORTAL
            </div>
          </header>
  
          {/* MAIN */}
          <main className="admin-portal-main">
  
            <section className="admin-portal-intro">
              <div className="admin-portal-icon">
                <ShieldCheck size={34} />
              </div>
  
              <div>
                <p className="admin-system-label">
                  GRADLY ADMINISTRATION SYSTEM
                </p>
  
                <h1>Admin Portal</h1>
  
                <p>
                  Authorized department administrators can access
                  academic administration tools, feedback management,
                  and curriculum administration.
                </p>
              </div>
            </section>
  
            {/* ADMIN OPTIONS */}
            <section className="admin-portal-options">
  
              {/* CONTINUE AS ADMIN */}
              <button
                type="button"
                className="admin-option-card"
                onClick={() => navigate("/admin/login")}
              >
                <div className="admin-option-icon">
                  <LogIn size={28} />
                </div>
  
                <div className="admin-option-content">
                  <span className="admin-option-label">
                    AUTHORIZED ADMIN
                  </span>
  
                  <h2>Continue as Admin</h2>
  
                  <p>
                    Already approved for administrative access?
                    Sign in using your admin username and password.
                  </p>
                </div>
  
                <ArrowRight
                  className="admin-option-arrow"
                  size={22}
                />
              </button>
  
              {/* APPLY FOR ADMIN */}
              <button
                type="button"
                className="admin-option-card"
                onClick={() => navigate("/admin/apply")}
              >
                <div className="admin-option-icon">
                  <FilePlus2 size={28} />
                </div>
  
                <div className="admin-option-content">
                  <span className="admin-option-label">
                    NEW APPLICANT
                  </span>
  
                  <h2>Apply for Admin Access</h2>
  
                  <p>
                    Are you a student interested in becoming a
                    department administrator? Submit your application
                    for review.
                  </p>
                </div>
  
                <ArrowRight
                  className="admin-option-arrow"
                  size={22}
                />
              </button>
  
            </section>
  
            {/* INFORMATION */}
            <section className="admin-portal-notice">
              <strong>
                Administrative access is controlled by Super Admin
                approval.
              </strong>
  
              <span>
                New applications are reviewed before an administrator
                account is activated.
              </span>
            </section>
  
          </main>
  
          {/* FOOTER */}
          <footer className="admin-portal-footer">
            <span>
              GRADLY Development and Administration System
            </span>
  
            <span>
              Authorized access only
            </span>
          </footer>
  
        </div>
      </div>
    );
  }
  
  export default AdminPortal;