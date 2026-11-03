import {
  Activity,
  BellRing,
  Send,
  BookOpen,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  KeyRound,
  LogOut,
  Menu,
  X,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Users
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import "../styles/super-admin.css";


const controlNavigation = [
  {
    label: "Dashboard",
    path: "/super-admin",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Users",
    path: "/super-admin/users",
    icon: Users,
  },
  {
    label: "Administrators",
    path: "/super-admin/admins",
    icon: ShieldCheck,
  },
  {
    label: "Applications",
    path: "/super-admin/applications",
    icon: ClipboardList,
  },
  {
    label: "Request Center",
    path: "/super-admin/requests",
    icon: ClipboardList,
  },
  {
    label: "Password Requests",
    path: "/super-admin/password-requests",
    icon: KeyRound,
  },
  {
    label: "Security Alerts",
    path: "/super-admin/security-alerts",
    icon: BellRing,
  },
  {
    label: "Admin Announcements",
    path: "/super-admin/admin-announcements",
    icon: Send,
  },
  {
    label: "Admin Subject Requests",
    path: "/super-admin/admin-requests",
    icon: ClipboardList,
  },
  {
    label: "Feedback",
    path: "/super-admin/feedback",
    icon: MessageSquare,
  },
  {
    label: "Curriculum",
    path: "/super-admin/curriculum",
    icon: BookOpen,
  },
  {
    label: "Audit Logs",
    path: "/super-admin/audit",
    icon: ScrollText,
  },
];


const systemNavigation = [
  {
    label: "Settings",
    path: "/super-admin/settings",
    icon: Settings,
  },
];


export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const [unattendedCount, setUnattendedCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const loadRequestCounts = useCallback(async () => {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) return;
    try {
      const root = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";
      const response = await fetch(root + "/super-admin/platform-requests", { headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
      if (!response.ok) return;
      const data = await response.json();
      setUnattendedCount(Number(data.counts?.unattended) || 0);
      setNewCount(Number(data.counts?.unacknowledged) || 0);
    } catch { /* Keep the last known badge count while offline. */ }
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    void loadRequestCounts();
    const timer = window.setInterval(() => void loadRequestCounts(), 45000);
    return () => window.clearInterval(timer);
  }, [loadRequestCounts]);


  function handleLogout() {

    localStorage.removeItem(
      "gradly_super_admin_token"
    );

    navigate(
      "/super-admin/login",
      {
        replace: true,
      }
    );
  }


  return (
    <div className="super-admin-shell">

      {/* =====================================================
          TOP BAR
          ===================================================== */}

      <header className="super-admin-topbar">

        <div className="topbar-brand">

          <div className="brand-mark">
            G
          </div>

          <div className="brand-text">

            <div className="brand-name">
              GRADLY
            </div>

            <div className="brand-product">
              ECOSYSTEM
            </div>

          </div>

        </div>


        <div className="topbar-center">

          <span className="system-path">
            SYSTEM / SUPER ADMINISTRATION
          </span>

        </div>


        <button type="button" className="super-admin-mobile-menu" aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileNavOpen} aria-controls="super-admin-navigation" onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? <X size={20}/> : <Menu size={20}/>}</button>

        <div className="topbar-status">

          <span className="status-light" />

          <span>
            ONLINE
          </span>

        </div>

      </header>


      {/* =====================================================
          BODY
          ===================================================== */}

      <div className="super-admin-body">


        {/* ===================================================
            SIDEBAR
            =================================================== */}

        {mobileNavOpen && <button type="button" className="super-admin-nav-backdrop" aria-label="Close navigation menu" onClick={() => setMobileNavOpen(false)} />}
        <aside id="super-admin-navigation" className={`super-admin-sidebar${mobileNavOpen ? " is-mobile-open" : ""}`} aria-label="Super Admin navigation">


          <div className="sidebar-heading">
            CONTROL
          </div>


          <nav className="sidebar-navigation" aria-label="Control navigation">

            {controlNavigation.map(
              (item) => {

                const Icon =
                  item.icon;

                return (

                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      `sidebar-link ${
                        isActive
                          ? "sidebar-link-active"
                          : ""
                      }`
                    }
                  >

                    <Icon
                      size={17}
                      strokeWidth={1.8}
                    />

                    <span>
                      {item.label}
                    </span>
                    {item.path === "/super-admin/requests" && unattendedCount > 0 && (
                      <span className="sidebar-request-badge" title={newCount + " new, " + unattendedCount + " unattended"}>
                        {unattendedCount > 99 ? "99+" : unattendedCount}
                      </span>
                    )}

                    <ChevronRight
                      className="sidebar-arrow"
                      size={14}
                      strokeWidth={1.7}
                    />

                  </NavLink>

                );

              }
            )}

          </nav>


          {/* =================================================
              SYSTEM
              ================================================= */}

          <div className="sidebar-heading sidebar-system-heading">
            SYSTEM
          </div>


          <nav className="sidebar-navigation" aria-label="System navigation">

            {systemNavigation.map(
              (item) => {

                const Icon =
                  item.icon;

                return (

                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      `sidebar-link ${
                        isActive
                          ? "sidebar-link-active"
                          : ""
                      }`
                    }
                  >

                    <Icon
                      size={17}
                      strokeWidth={1.8}
                    />

                    <span>
                      {item.label}
                    </span>

                    <ChevronRight
                      className="sidebar-arrow"
                      size={14}
                      strokeWidth={1.7}
                    />

                  </NavLink>

                );

              }
            )}

          </nav>


          {/* =================================================
              SPACER
              ================================================= */}

          <div className="sidebar-spacer" />


          {/* =================================================
              LOGOUT
              ================================================= */}

          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
          >

            <LogOut
              size={17}
              strokeWidth={1.8}
            />

            <span>
              Logout
            </span>

          </button>


          {/* =================================================
              VERSION
              ================================================= */}

          <div className="sidebar-version">

            GRADLY ECOSYSTEM

            <br />

            ADMIN SYSTEM / V2

          </div>

        </aside>


        {/* ===================================================
            CONTENT
            =================================================== */}

        <main className="super-admin-content">


          {/* SYSTEM STRIP */}

          <div className="content-system-strip">

            <div className="content-system-left">

              <Activity
                size={15}
                strokeWidth={1.8}
              />

              <span>
                SYSTEM STATUS
              </span>

              <span className="system-status-value">
                NORMAL
              </span>

            </div>


            <div className="content-system-right">

              SUPER ADMIN

            </div>

          </div>


          {/* PAGE */}

          <div className="super-admin-page">

            <Outlet />

          </div>

        </main>

      </div>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <footer className="super-admin-footer">

        <span>
          GRADLY ECOSYSTEM
        </span>

        <span>
          INTERNAL ADMINISTRATION SYSTEM
        </span>

        <span>
          SECURE ENVIRONMENT
        </span>

      </footer>

    </div>
  );
}