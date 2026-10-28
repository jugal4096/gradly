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
  for (const key of ["data", "items", "requests", "feedback", "events", "activity", "notifications", "rows"]) {
    if (Array.isArray(record[key])) return countRecords(record[key]);
  }
  if (record.data && typeof record.data === "object") return countRecords(record.data);
  return 0;
}

const badgeEndpoints: Record<string, string> = {
  "/super-admin/applications": "/api/super-admin/applications?status=PENDING",
  "/super-admin/institutions": "/api/super-admin/institutions/requests?status=OPEN",
  "/super-admin/feedback": "/api/super-admin/feedback?status=OPEN",
  "/super-admin/admin-requests": "/api/super-admin/admin-subject-change-requests?status=PENDING",
  "/super-admin/curriculum": "/api/super-admin/admin-subject-change-requests?status=PENDING",
  "/super-admin/password-requests": "/api/admin-password-requests/review",
  "/super-admin/institution-requests": "/api/super-admin/institutions/requests?status=OPEN",
  "/super-admin/guest-sessions": "/api/super-admin/security-notifications",
  "/super-admin/security-notifications": "/api/super-admin/security-notifications",

};

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});

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


        {/* ===================================================
            SIDEBAR
            =================================================== */}

        <aside className="super-admin-sidebar">


          <div className="sidebar-heading">
            CONTROL
          </div>


          <nav className="sidebar-navigation">

            {controlNavigation.map(
              (item) => {

                const Icon =
                  item.icon;

                return (

                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
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

                    {(queueCounts[item.path] || 0) > 0 && (
                      <span className="sidebar-count" aria-label={String(queueCounts[item.path]) + " pending items"}>
                        {queueCounts[item.path] > 99 ? "99+" : queueCounts[item.path]}
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


          <nav className="sidebar-navigation">

            {systemNavigation.map(
              (item) => {

                const Icon =
                  item.icon;

                return (

                  <NavLink
                    key={item.path}
                    to={item.path}
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