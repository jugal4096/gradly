import {
  Activity,
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  KeyRound,
  Users,
  Menu,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";
import { API_BASE_URL, getToken } from "../lib/superAdminSession";

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
    label: "Institutions",
    path: "/super-admin/institutions",
    icon: Building2,
  },
  { label: "Institution requests", path: "/super-admin/institution-requests", icon: ClipboardList },
  { label: "Guest activity", path: "/super-admin/guest-sessions", icon: Activity },
  { label: "Security notifications", path: "/super-admin/security-notifications", icon: ShieldCheck },
  { label: "Student syllabus feedback", path: "/super-admin/student-feedback", icon: MessageSquare },
  {
    label: "Curriculum",
    path: "/super-admin/curriculum",
    icon: BookOpen,
  },
  {
    label: "Feedback",
    path: "/super-admin/feedback",
    icon: MessageSquare,
  },
  {
    label: "Admin change requests",
    path: "/super-admin/admin-requests",
    icon: ClipboardList,
  },
  {
    label: "Password requests",
    path: "/super-admin/password-requests",
    icon: KeyRound,
  },
  {
    label: "Audit Logs",
    path: "/super-admin/audit-logs",
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


function countRecords(value: unknown): number {
  if (Array.isArray(value)) return value.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const status = String(row.status ?? row.request_status ?? "").trim().toUpperCase().replace(/[ -]+/g, "_");
    if (status) return ["PENDING", "OPEN", "IN_REVIEW", "UNREAD", "NEW", "SUBMITTED"].includes(status);
    if (row.read_at !== undefined || row.readAt !== undefined) return !row.read_at && !row.readAt;
    return true;
  }).length;
  if (!value || typeof value !== "object") return 0;
  const record = value as Record<string, unknown>;
  for (const key of ["data", "items", "requests", "applications", "feedback", "events", "activity", "notifications", "rows"]) {
    if (Array.isArray(record[key])) return countRecords(record[key]);
  }
  if (record.data && typeof record.data === "object") return countRecords(record.data);
  return 0;
}

const badgeEndpoints: Record<string, string> = {
  "/super-admin/applications": "/api/super-admin/applications?status=PENDING",
  "/super-admin/feedback": "/api/super-admin/feedback?status=OPEN",
  "/super-admin/admin-requests": "/api/super-admin/admin-subject-change-requests?status=PENDING",
  "/super-admin/password-requests": "/api/admin-password-requests/review",
  "/super-admin/institution-requests": "/api/super-admin/institutions/requests?status=OPEN",
  "/super-admin/security-notifications": "/api/super-admin/security-notifications",

};

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const token = getToken();
    if (!token) return;
    const refreshCounts = async () => {
      const entries = await Promise.all(Object.entries(badgeEndpoints).map(async ([path, endpoint]) => {
        try {
          const response = await fetch(API_BASE_URL + endpoint, {
            headers: { Accept: "application/json", Authorization: "Bearer " + token },
          });
          if (!response.ok) return [path, 0] as const;
          return [path, countRecords(await response.json())] as const;
        } catch {
          return [path, 0] as const;
        }
      }));
      if (alive) setQueueCounts(Object.fromEntries(entries));
    };
    void refreshCounts();
    return () => { alive = false; };
  }, []);


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


        {/* Workspace navigation is hidden until the hamburger is clicked. */}
        {workspaceOpen && (
          <>
            <button
              type="button"
              className="sa-workspace-backdrop"
              aria-label="Close workspace menu"
              onClick={() => setWorkspaceOpen(false)}
            />
            <aside className="sa-workspace-drawer" aria-label="Super Admin workspace">
              <div className="sa-workspace-drawer-head">
                <div className="sa-workspace-brand">
                  <span className="brand-mark">G</span>
                  <span><strong>GRADLY</strong><small>ECOSYSTEM · WORKSPACE</small></span>
                </div>
                <button type="button" className="sa-workspace-close" aria-label="Close workspace" onClick={() => setWorkspaceOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="sa-workspace-caption">CONTROL CENTER</div>
              <nav className="sa-workspace-nav" aria-label="Super Admin navigation">
                {controlNavigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end}
                      onClick={() => setWorkspaceOpen(false)}
                      className={({ isActive }) => `sa-workspace-link ${isActive ? "is-active" : ""}`}
                    >
                      <Icon size={18} strokeWidth={1.9} />
                      <span>{item.label}</span>
                      {(queueCounts[item.path] || 0) > 0 && (
                        <span className="sidebar-count">{queueCounts[item.path] > 99 ? "99+" : queueCounts[item.path]}</span>
                      )}
                      <ChevronRight size={15} className="sa-workspace-chevron" />
                    </NavLink>
                  );
                })}
                <div className="sa-workspace-caption sa-workspace-system">SYSTEM</div>
                {systemNavigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.path} to={item.path} onClick={() => setWorkspaceOpen(false)} className={({ isActive }) => `sa-workspace-link ${isActive ? "is-active" : ""}`}>
                      <Icon size={18} strokeWidth={1.9} /><span>{item.label}</span><ChevronRight size={15} className="sa-workspace-chevron" />
                    </NavLink>
                  );
                })}
              </nav>
              <div className="sa-workspace-drawer-footer">
                <span><ShieldCheck size={16} /> Secure Super Admin session</span>
                <button type="button" onClick={handleLogout}><LogOut size={17} /> Sign out</button>
              </div>
            </aside>
          </>
        )}

        {/* ===================================================
            CONTENT
            =================================================== */}

        <main className="super-admin-content">


          {/* SYSTEM STRIP */}

          <div className="content-system-strip">

            <div className="content-system-left">
              <button
                type="button"
                className="sa-workspace-toggle"
                aria-label={workspaceOpen ? "Close workspace navigation" : "Open workspace navigation"}
                aria-expanded={workspaceOpen}
                onClick={() => setWorkspaceOpen((open) => !open)}
              >
                {workspaceOpen ? <X size={20} /> : <Menu size={21} />}
              </button>
              <Activity size={15} strokeWidth={1.8} />
              <span>SYSTEM STATUS</span>
              <span className="system-status-value">NORMAL</span>
            </div>

            <div className="content-system-right">
              <span className="sa-shell-role">SUPER ADMIN</span>
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