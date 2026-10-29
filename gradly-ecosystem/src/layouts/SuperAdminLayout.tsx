import {
  Activity,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

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
];


const systemNavigation = [
  {
    label: "Settings",
    ];


export default function SuperAdminLayout() {

  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === "/super-admin") {
    return <Outlet />;
  }


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
            AUTHENTICATED
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
                SESSION VERIFIED
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