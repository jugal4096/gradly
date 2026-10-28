import {
    Activity,
    BookOpen,
    ClipboardList,
    MessageSquare,
    RefreshCw,
    ShieldCheck,
    Users,
  } from "lucide-react";
  
  import { useEffect, useState } from "react";
  import { useNavigate } from "react-router-dom";
  
  import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
  import "../../styles/super-admin-dashboard.css";
  
  interface Student {
    id: string;
    email: string | null;
    display_name: string | null;
    role: string;
    active: boolean;
    last_login_at: string | null;
    created_at: string;
    student_identifier: string | null;
    current_semester_number: number | null;
    current_cgpa: number | null;
    branch_name: string | null;
  }
  
  interface UsersResponse {
    students: Student[];
    count: number;
  }
  
  const modules = [
    {
      label: "Administrators",
      description: "Registered administrative accounts",
      icon: ShieldCheck,
      path: "/super-admin/admins",
    },
    {
      label: "Applications",
      description: "Pending administrator applications",
      icon: ClipboardList,
      path: "/super-admin/applications",
    },
    {
      label: "Feedback",
      description: "Open feedback requests",
      icon: MessageSquare,
      path: "/super-admin/feedback",
    },
    {
      label: "Curriculum",
      description: "Pending curriculum changes",
      icon: BookOpen,
      path: "/super-admin/curriculum",
    },
  ];
  
  export default function SuperAdminDashboard() {
    const navigate = useNavigate();
  
    const [activeUsers, setActiveUsers] = useState<number | null>(null);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState(false);
  
    async function loadActiveUsers() {
      const token = localStorage.getItem("gradly_super_admin_token");
  
      if (!token) {
        setUsersLoading(false);
        setUsersError(true);
        return;
      }
  
      try {
        setUsersLoading(true);
        setUsersError(false);
  
        if (!isApiConfigured) {
          throw new Error(API_CONFIGURATION_ERROR);
        }

        const response = await fetch(`${API_BASE_URL}/api/super-admin/users`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
  
        if (!response.ok) {
          throw new Error("Failed to load users.");
        }
  
        const data: UsersResponse = await response.json();
  
        const activeCount = Array.isArray(data.students)
          ? data.students.filter((student) => student.active === true).length
          : 0;
  
        setActiveUsers(activeCount);
      } catch (error) {
        console.error("Failed to load active users:", error);
        setUsersError(true);
        setActiveUsers(null);
      } finally {
        setUsersLoading(false);
      }
    }
  
    useEffect(() => {
      loadActiveUsers();
    }, []);
  
    function handleUsersClick() {
      navigate("/super-admin/users");
    }
  
    return (
      <div className="super-dashboard">
        {/* =====================================================
            HEADER
            ===================================================== */}
  
        <div className="super-dashboard-heading">
          <div>
            <div className="super-dashboard-kicker">
              GRADLY / SYSTEM CONTROL
            </div>
  
            <h1>Super Admin Dashboard</h1>
  
            <p>
              Central administration and governance console for the Gradly
              ecosystem.
            </p>
          </div>
  
          <div className="dashboard-status">
            <Activity size={15} strokeWidth={1.8} />
  
            <span>SYSTEM READY</span>
          </div>
        </div>
  
        {/* =====================================================
            MODULES
            ===================================================== */}
  
        <section className="dashboard-module-grid">
          {/* USERS */}
  
          <button
            type="button"
            className="dashboard-module dashboard-module-clickable"
            onClick={handleUsersClick}
            title="Open user management"
          >
            <div className="module-icon module-icon-users">
              <Users size={19} strokeWidth={1.8} />
            </div>
  
            <div className="module-info">
              <div className="module-label">Users</div>
  
              <div className="module-value module-value-with-refresh">
                {usersLoading ? (
                  <span className="module-loading">...</span>
                ) : usersError ? (
                  <span className="module-error">ERR</span>
                ) : (
                  activeUsers ?? 0
                )}
  
                <span
                  className="module-refresh-button"
                  role="button"
                  tabIndex={0}
                  title="Refresh active users"
                  onClick={(event) => {
                    event.stopPropagation();
                    loadActiveUsers();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      loadActiveUsers();
                    }
                  }}
                >
                  <RefreshCw
                    size={13}
                    strokeWidth={1.8}
                    className={usersLoading ? "refresh-spinning" : ""}
                  />
                </span>
              </div>
  
              <div className="module-description">
                Currently active student accounts
              </div>
            </div>
          </button>
  
          {/* EXISTING MODULES */}
  
          {modules.map((module) => {
            const Icon = module.icon;
  
            return (
              <button
                type="button"
                className="dashboard-module dashboard-module-clickable"
                key={module.label}
                onClick={() => navigate(module.path)}
                title={`Open ${module.label}`}
              >
                <div className="module-icon">
                  <Icon size={19} strokeWidth={1.8} />
                </div>
  
                <div className="module-info">
                  <div className="module-label">{module.label}</div>
  
                  <div className="module-value">—</div>
  
                  <div className="module-description">
                    {module.description}
                  </div>
                </div>
              </button>
            );
          })}
        </section>
  
        {/* =====================================================
            SYSTEM INFORMATION
            ===================================================== */}
  
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>SYSTEM INFORMATION</div>
  
            <span>V2</span>
          </div>
  
          <div className="dashboard-information">
            <div>
              <span>Environment</span>
  
              <strong>Development</strong>
            </div>
  
            <div>
              <span>Administration Mode</span>
  
              <strong>Super Admin</strong>
            </div>
  
            <div>
              <span>Database</span>
  
              <strong>PostgreSQL</strong>
            </div>
  
            <div>
              <span>Authentication</span>
  
              <strong>Protected</strong>
            </div>
          </div>
        </section>
  
        {/* =====================================================
            ACTIVE USERS INFORMATION
            ===================================================== */}
  
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>USER ACTIVITY</div>
  
            <span>LIVE DATA</span>
          </div>
  
          <div className="dashboard-user-summary">
            <div className="dashboard-user-summary-icon">
              <Users size={20} strokeWidth={1.8} />
            </div>
  
            <div className="dashboard-user-summary-content">
              <span className="dashboard-user-summary-label">
                ACTIVE STUDENT ACCOUNTS
              </span>
  
              <strong>
                {usersLoading
                  ? "Loading..."
                  : usersError
                    ? "Unavailable"
                    : activeUsers ?? 0}
              </strong>
  
              <p>
                Number of student accounts currently marked as active in the
                Gradly system.
              </p>
            </div>
  
            <button
              type="button"
              className="dashboard-user-summary-button"
              onClick={handleUsersClick}
            >
              OPEN USERS
            </button>
          </div>
        </section>
  
        {/* =====================================================
            ADMINISTRATIVE ACTIVITY
            ===================================================== */}
  
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>ADMINISTRATIVE ACTIVITY</div>
  
            <span>LIVE DATA</span>
          </div>
  
          <div className="dashboard-empty">
            <Activity size={20} strokeWidth={1.8} />
  
            <strong>No activity loaded</strong>
  
            <p>
              Administrative activity will appear here once the audit API is
              connected.
            </p>
          </div>
        </section>
      </div>
    );
  }