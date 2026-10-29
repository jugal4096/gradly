import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  UserCog,
  MessageSquare,
  Menu,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import "../../styles/super-admin-dashboard.css";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";

const STATS_ENDPOINT = `${API_BASE_URL}/api/super-admin/dashboard/stats`;

type Stats = {
  totalUsers: number | null;
  totalAdmins: number;
  totalInstitutions: number;
  totalCourses: number;
  pendingApplications: number;
  pendingCurriculumRequests: number;
  pendingAdminRequests: number;
  openFeedback: number;
};

type ActivityItem = {
  id: string;
  title: string;
  description?: string;
  actorName?: string;
  createdAt?: string;
  category?: string;
};

type OverviewKey =
  | "totalUsers"
  | "totalAdmins"
  | "totalInstitutions"
  | "totalCourses";

type QueueKey =
  | "pendingApplications"
  | "pendingCurriculumRequests"
  | "pendingAdminRequests"
  | "openFeedback";

type ActivityFilter =
  | "all"
  | "users"
  | "admins"
  | "curriculum";

const EMPTY_STATS: Stats = {
  totalUsers: null,
  totalAdmins: 0,
  totalInstitutions: 0,
  totalCourses: 0,
  pendingApplications: 0,
  pendingCurriculumRequests: 0,
  pendingAdminRequests: 0,
  openFeedback: 0,
};

const overviewCards: {
  key: OverviewKey;
  label: string;
  description: string;
  icon: typeof Users;
  tone: string;
  detail: string;
}[] = [
  {
    key: "totalUsers",
    label: "Total users",
    description: "Global count not exposed by API",
    icon: Users,
    tone: "violet",
    detail: "A verified platform-wide user total is not provided by the current dashboard API.",
  },
  {
    key: "totalAdmins",
    label: "Administrators",
    description: "Administrative accounts",
    icon: ShieldCheck,
    tone: "blue",
    detail: "Review administrator accounts, assignments and permissions.",
  },
  {
    key: "totalInstitutions",
    label: "Institutions",
    description: "Connected institutions",
    icon: Building2,
    tone: "green",
    detail: "Inspect registered institutions and their branches.",
  },
  {
    key: "totalCourses",
    label: "Courses",
    description: "Academic course catalogue",
    icon: BookOpen,
    tone: "amber",
    detail: "Review courses and their associated academic curriculum.",
  },
];

const queueCards: {
  key: QueueKey;
  label: string;
  description: string;
  icon: typeof ClipboardList;
  tone: string;
}[] = [
  {
    key: "pendingApplications",
    label: "Admin applications",
    description: "Administrator applications awaiting review",
    icon: ClipboardList,
    tone: "violet",
  },
  {
    key: "pendingCurriculumRequests",
    label: "Curriculum requests",
    description: "Proposed academic curriculum changes",
    icon: BookOpen,
    tone: "blue",
  },
  {
    key: "pendingAdminRequests",
    label: "Admin requests",
    description: "Requests submitted by administrators",
    icon: FileText,
    tone: "amber",
  },
  {
    key: "openFeedback",
    label: "Feedback",
    description: "Open feedback items",
    icon: MessageSquare,
    tone: "green",
  },
];

const quickActions: {
  label: string;
  description: string;
  icon: typeof Users;
  target: OverviewKey;
}[] = [
  {
    label: "Open user records",
    description: "Review platform accounts",
    icon: Users,
    target: "totalUsers",
  },
  {
    label: "Review administrator metrics",
    description: "Review access and permissions",
    icon: ShieldCheck,
    target: "totalAdmins",
  },
  {
    label: "Inspect institution metrics",
    description: "Inspect institutions and branches",
    icon: Building2,
    target: "totalInstitutions",
  },
  {
    label: "Inspect course metrics",
    description: "Inspect academic courses",
    icon: BookOpen,
    target: "totalCourses",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function safeCount(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function nullableCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : null;
}

function formatCount(value: number | null): string {
  return value === null ? "—" : formatNumber(value);
}

function formatDate(value?: string) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to load dashboard data.";
}

function normalizeActivity(
  item: Record<string, unknown>,
  index: number
): ActivityItem {
  const action = String(
    item.action ?? item.title ?? "Administrative activity"
  );

  const actorRole = item.actorRole
    ? String(item.actorRole)
    : item.actor_role
      ? String(item.actor_role)
      : "";

  const entityTable = item.entityTable
    ? String(item.entityTable)
    : item.entity_table
      ? String(item.entity_table)
      : "";

  const explicitDescription = item.description
    ? String(item.description)
    : "";

  const description =
    explicitDescription ||
    ([actorRole, entityTable].filter(Boolean).join(" · ") ||
      "Administrative event");

  const categoryText = [
    action,
    actorRole,
    entityTable,
    item.category ? String(item.category) : "",
  ]
    .join(" ")
    .toLowerCase();

  let category = "other";

  if (
    categoryText.includes("curriculum") ||
    categoryText.includes("course") ||
    categoryText.includes("subject")
  ) {
    category = "curriculum";
  } else if (
    categoryText.includes("admin") ||
    categoryText.includes("permission") ||
    categoryText.includes("role")
  ) {
    category = "admins";
  } else if (
    categoryText.includes("user") ||
    categoryText.includes("account") ||
    categoryText.includes("login")
  ) {
    category = "users";
  }

  return {
    id: String(item.id ?? index),
    title: action,
    description,
    actorName: actorRole || undefined,
    createdAt: item.createdAt
      ? String(item.createdAt)
      : item.created_at
        ? String(item.created_at)
        : undefined,
    category,
  };
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedOverview, setSelectedOverview] =
    useState<OverviewKey | null>(null);

  const [selectedQueue, setSelectedQueue] =
    useState<QueueKey | null>(null);

  const [selectedAction, setSelectedAction] =
    useState<OverviewKey | null>(null);

  const [activitySearch, setActivitySearch] = useState("");
  const [activityFilter, setActivityFilter] =
    useState<ActivityFilter>("all");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!isApiConfigured) {
        throw new Error(API_CONFIGURATION_ERROR);
      }

      const token = localStorage.getItem("gradly_super_admin_token");

      const response = await fetch(STATS_ENDPOINT, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("gradly_super_admin_token");
          navigate("/super-admin/login", { replace: true });
          throw new Error("Your session expired. Please sign in again.");
        }

        if (response.status === 403) {
          throw new Error(
            "This account does not have permission to access the dashboard."
          );
        }

        if (response.status === 404) {
          throw new Error(
            "The dashboard statistics endpoint was not found. Check the backend route."
          );
        }

        throw new Error(`Dashboard request failed (${response.status}).`);
      }

      const result = await response.json();

      if (result?.success === false) {
        throw new Error(
          result.message ??
            "The server could not return dashboard statistics."
        );
      }

      const data = result?.data ?? result;

      setStats({
        totalUsers: nullableCount(data.totalUsers),
        totalAdmins: safeCount(data.totalAdmins),
        totalInstitutions: safeCount(data.totalInstitutions),
        totalCourses: safeCount(data.totalCourses),
        pendingApplications: safeCount(data.pendingApplications),
        pendingCurriculumRequests: safeCount(
          data.pendingCurriculumRequests
        ),
        pendingAdminRequests: safeCount(data.pendingAdminRequests),
        openFeedback: safeCount(data.openFeedback),
      });

      setActivities(
        Array.isArray(data.recentActivity)
          ? data.recentActivity.map(
              (
                item: Record<string, unknown>,
                index: number
              ) => normalizeActivity(item, index)
            )
          : []
      );
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!menuOpen) return;

    const drawer = drawerRef.current;

    const getFocusableElements = () =>
      drawer?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? [];

    getFocusableElements()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(getFocusableElements());

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  function goToSection(sectionId: string) {
    setMenuOpen(false);

    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }, 50);
  }

  function openApplications() {
    setMenuOpen(false);
    navigate("/super-admin/applications");
  }

  function signOut() {
    localStorage.removeItem("gradly_super_admin_token");
    setMenuOpen(false);
    navigate("/super-admin/login", { replace: true });
  }

  const filteredActivities = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();

    return activities.filter((item) => {
      const searchableText = [
        item.title,
        item.description,
        item.actorName,
        item.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchableText.includes(query);

      const category = (item.category ?? "").toLowerCase();

      const matchesFilter =
        activityFilter === "all" ||
        (activityFilter === "users" &&
          (category.includes("user") ||
            searchableText.includes("user"))) ||
        (activityFilter === "admins" &&
          (category.includes("admin") ||
            searchableText.includes("admin"))) ||
        (activityFilter === "curriculum" &&
          (category.includes("curriculum") ||
            searchableText.includes("curriculum")));

      return matchesSearch && matchesFilter;
    });
  }, [activities, activitySearch, activityFilter]);

  const pendingTotal =
    stats.pendingApplications +
    stats.pendingCurriculumRequests +
    stats.pendingAdminRequests +
    stats.openFeedback;

  const selectedOverviewCard = overviewCards.find(
    (card) => card.key === selectedOverview
  );

  const selectedQueueCard = queueCards.find(
    (card) => card.key === selectedQueue
  );

  const selectedActionCard = quickActions.find(
    (action) => action.target === selectedAction
  );

  function closeDetails() {
    setSelectedOverview(null);
    setSelectedQueue(null);
    setSelectedAction(null);
  }

  function openOverview(key: OverviewKey) {
    setSelectedOverview(key);
    setSelectedQueue(null);
    setSelectedAction(null);
  }

  function openQueue(key: QueueKey) {
    setSelectedQueue(key);
    setSelectedOverview(null);
    setSelectedAction(null);
  }

  function openAction(target: OverviewKey) {
    setSelectedAction(target);
    setSelectedOverview(null);
    setSelectedQueue(null);
  }

  const selectedCount: number | null =
    selectedOverviewCard
      ? stats[selectedOverviewCard.key]
      : selectedQueueCard
        ? stats[selectedQueueCard.key]
        : selectedActionCard
          ? stats[selectedActionCard.target]
          : null;

  return (
    <main className="super-dashboard">
      <div className="sd-background-orb sd-orb-one" aria-hidden="true" />
      <div className="sd-background-orb sd-orb-two" aria-hidden="true" />

      <div className="sd-shell">
        <div className="sd-main-column">
          <div className="sd-navigation-bar">
            <div className="sd-brand-lockup" aria-label="Gradly Ecosystem">
              <span className="sd-brand-mark">G</span>
              <span className="sd-brand-name">
                GRADLY <small>ECOSYSTEM</small>
              </span>
            </div>

            <div className="sd-navigation-actions">
              <span className="sd-access-chip">
                <ShieldCheck size={14} /> Super Admin
              </span>

              <button
                type="button"
                className="sd-menu-toggle"
                aria-label={
                  menuOpen ? "Close navigation menu" : "Open navigation menu"
                }
                aria-expanded={menuOpen}
                aria-controls="sd-navigation-drawer"
                ref={menuButtonRef}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X size={19} /> : <Menu size={19} />}
                <span>{menuOpen ? "Close menu" : "Menu"}</span>
              </button>
            </div>
          </div>

          {menuOpen && (
            <>
              <button
                type="button"
                className="sd-menu-backdrop"
                aria-label="Close navigation menu"
                onClick={() => setMenuOpen(false)}
              />

              <aside
                id="sd-navigation-drawer"
                ref={drawerRef}
                className="sd-navigation-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="sd-drawer-title"
              >
                <div className="sd-drawer-heading">
                  <div>
                    <span className="sd-section-kicker">
                      GRADLY / CONTROL CENTER
                    </span>
                    <h2 id="sd-drawer-title">Navigation</h2>
                  </div>

                  <button
                    type="button"
                    className="sd-icon-button"
                    aria-label="Close navigation menu"
                    onClick={() => setMenuOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <nav
                  className="sd-drawer-nav"
                  aria-label="Super Admin navigation"
                >
                  <button
                    type="button"
                    className="sd-drawer-link is-current"
                    onClick={() => goToSection("sd-dashboard-top")}
                  >
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="sd-drawer-link"
                    onClick={() => navigate("/super-admin/users")}
                  >
                    <Users size={18} />
                    <span>Users</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="sd-drawer-link"
                    onClick={() => navigate("/super-admin/admins")}
                  >
                    <UserCog size={18} />
                    <span>Admins</span>
                    <ArrowRight size={15} />
                  </button>

                  

                  

                  <button
                    type="button"
                    className="sd-drawer-link"
                    onClick={openApplications}
                  >
                    <ClipboardList size={18} />
                    <span>Applications</span>
                    <ArrowRight size={15} />
                  </button>

                  <div className="sd-drawer-divider" />

                  

                  

                  

                  

                  <div className="sd-drawer-divider" />

                  <button
                    type="button"
                    className="sd-drawer-link"
                    onClick={() => goToSection("sd-platform-metrics")}
                  >
                    <Users size={18} />
                    <span>Platform metrics</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="sd-drawer-link"
                    onClick={() => goToSection("sd-work-queues")}
                  >
                    <ClipboardList size={18} />
                    <span>Work queues</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="sd-drawer-link"
                    onClick={() => goToSection("sd-quick-actions")}
                  >
                    <ShieldCheck size={18} />
                    <span>Quick actions</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="sd-drawer-link"
                    onClick={() => goToSection("sd-recent-activity")}
                  >
                    <Activity size={18} />
                    <span>Recent activity</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="sd-drawer-link"
                    onClick={() => goToSection("sd-system-information")}
                  >
                    <Building2 size={18} />
                    <span>System information</span>
                    <ArrowRight size={15} />
                  </button>
                </nav>

                <div className="sd-drawer-footer">
                  <div className="sd-drawer-secure-note">
                    <ShieldCheck size={16} />
                    <span>Protected administrative workspace</span>
                  </div>

                  <button
                    type="button"
                    className="sd-signout-button"
                    onClick={signOut}
                  >
                    <LogOut size={17} />
                    Sign out
                  </button>
                </div>
              </aside>
            </>
          )}

          <div id="sd-dashboard-top" />

          <header className="sd-header">
            <div className="sd-header-copy">
              <div className="sd-eyebrow">
                <span className="sd-eyebrow-dot" />
                GRADLY <span className="sd-slash">/</span> SYSTEM CONTROL
              </div>

              <h1>Super Admin Dashboard</h1>

              <p>
                Your command centre for users, administrators,
                institutions and academic governance.
              </p>
            </div>

            <button
              className="sd-refresh-button"
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "sd-spin" : ""}
              />
              {loading ? "Refreshing…" : "Refresh data"}
            </button>
          </header>

          <section className="sd-hero">
            <div className="sd-hero-symbol">
              <LayoutDashboard size={23} />
            </div>

            <div className="sd-hero-copy">
              <span className="sd-hero-label">ECOSYSTEM OVERVIEW</span>
              <h2>Everything under control.</h2>
              <p>
                Review platform activity and keep important
                administrative work moving.
              </p>
            </div>

            <div className="sd-hero-summary">
              <span className="sd-summary-label">OPEN WORK QUEUE</span>
              <strong>{loading || error ? "—" : formatNumber(pendingTotal)}</strong>
              <span className="sd-summary-caption">
                Items across dashboard queues
              </span>
            </div>
          </section>

          {error && (
            <section className="sd-error" role="alert">
              <div className="sd-error-icon">
                <AlertCircle size={19} />
              </div>

              <div className="sd-error-copy">
                <strong>Live data couldn't be loaded</strong>
                <p>{error}</p>
                <span>
                  Expected endpoint:{" "}
                  <code>/api/super-admin/dashboard/stats</code>
                </span>
              </div>

              <button
                className="sd-error-retry"
                type="button"
                onClick={() => void loadDashboard()}
              >
                Retry
              </button>
            </section>
          )}

          <section
            id="sd-platform-metrics"
            className="sd-section sd-anchor-section"
          >
            <div className="sd-section-heading">
              <div>
                <span className="sd-section-kicker">PLATFORM METRICS</span>
                <h2>At a glance</h2>
              </div>

              <span className="sd-data-status">
                <span className={error ? "sd-status-dot sd-dot-error" : "sd-status-dot"} />
                {loading ? "Updating data" : error ? "API unavailable" : "Live dashboard data"}
              </span>
            </div>

            <div className="sd-metrics-grid">
              {overviewCards.map((card) => {
                const Icon = card.icon;
                const active = selectedOverview === card.key;
                const value = stats[card.key];

                return (
                  <button
                    type="button"
                    key={card.key}
                    className={`sd-metric-card sd-tone-${card.tone} ${
                      active ? "is-selected" : ""
                    }`}
                    onClick={() => openOverview(card.key)}
                    aria-pressed={active}
                  >
                    <span className="sd-metric-top">
                      <span className="sd-metric-icon">
                        <Icon size={21} strokeWidth={1.8} />
                      </span>

                      <span className="sd-metric-arrow">
                        <ArrowUpRight size={17} />
                      </span>
                    </span>

                    <span className="sd-metric-label">{card.label}</span>

                    <span className="sd-metric-value">
                      {loading ? (
                        <span className="sd-skeleton" />
                      ) : error ? (
                        "—"
                      ) : (
                        formatCount(value)
                      )}
                    </span>

                    <span className="sd-metric-bottom">
                      <span>{card.description}</span>
                      <ArrowRight size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            id="sd-work-queues"
            className="sd-section sd-anchor-section"
          >
            <div className="sd-section-heading">
              <div>
                <span className="sd-section-kicker">ADMINISTRATION</span>
                <h2>Work queues</h2>
              </div>

              <span className="sd-muted-note">
                Select a card to inspect
              </span>
            </div>

            <div className="sd-queues-grid">
              {queueCards.map((card) => {
                const Icon = card.icon;
                const count = stats[card.key];
                const active = selectedQueue === card.key;

                return (
                  <button
                    type="button"
                    key={card.key}
                    className={`sd-queue-card sd-queue-${card.tone} ${
                      active ? "is-selected" : ""
                    }`}
                    onClick={() => openQueue(card.key)}
                    aria-pressed={active}
                  >
                    <span className="sd-queue-top">
                      <span className="sd-queue-icon">
                        <Icon size={19} />
                      </span>

                      <span
                        className={`sd-queue-count ${
                          count > 0 ? "has-pending" : ""
                        }`}
                      >
                        {loading || error ? "—" : formatNumber(count)}
                      </span>
                    </span>

                    <span className="sd-queue-title">{card.label}</span>

                    <span className="sd-queue-description">
                      {card.description}
                    </span>

                    <span className="sd-queue-footer">
                      <span
                        className={`sd-queue-status ${
                          count > 0 ? "is-pending" : ""
                        }`}
                      />

                      {loading
                        ? "Checking queue…"
                        : error
                          ? "Data unavailable"
                          : count > 0
                            ? "Awaiting attention"
                            : "No pending items"}

                      <ArrowRight size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {(selectedOverviewCard ||
            selectedQueueCard ||
            selectedActionCard) && (
            <section className="sd-detail-panel" aria-live="polite">
              <div className="sd-detail-heading">
                <div className="sd-detail-heading-icon">
                  <Activity size={19} />
                </div>

                <div>
                  <span className="sd-section-kicker">QUICK INSPECT</span>
                  <h2>
                    {selectedOverviewCard?.label ??
                      selectedQueueCard?.label ??
                      selectedActionCard?.label}
                  </h2>
                </div>

                <button
                  type="button"
                  className="sd-icon-button"
                  onClick={closeDetails}
                  aria-label="Close details"
                >
                  <X size={17} />
                </button>
              </div>

              <p className="sd-detail-description">
                {selectedOverviewCard?.detail ??
                  selectedQueueCard?.description ??
                  selectedActionCard?.description}
              </p>

              <div className="sd-detail-bottom">
                <div className="sd-detail-count">
                  <span>Current count</span>
                  <strong>
                    {loading || error ? "—" : formatCount(selectedCount)}
                  </strong>
                </div>

                <span className="sd-detail-hint">
                  <AlertCircle size={15} />
                  Management actions must be connected to their
                  authorized backend modules.
                </span>
              </div>
            </section>
          )}

          <div
            className="sd-content-grid sd-anchor-section"
            id="sd-quick-actions"
          >
            <section className="sd-panel sd-quick-actions">
              <div className="sd-panel-heading">
                <div>
                  <span className="sd-section-kicker">SHORTCUTS</span>
                  <h2>Quick actions</h2>
                </div>

                <span className="sd-panel-badge">MANAGE</span>
              </div>

              <div className="sd-action-list">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  const active = selectedAction === action.target;

                  return (
                    <button
                      type="button"
                      key={action.target}
                      className={`sd-action-item ${
                        active ? "is-selected" : ""
                      }`}
                      onClick={() => openAction(action.target)}
                    >
                      <span className="sd-action-icon">
                        <Icon size={18} />
                      </span>

                      <span className="sd-action-copy">
                        <strong>{action.label}</strong>
                        <span>{action.description}</span>
                      </span>

                      <ArrowRight
                        size={16}
                        className="sd-action-arrow"
                      />
                    </button>
                  );
                })}
              </div>

              <div className="sd-panel-note">
                <ShieldCheck size={15} />
                Access is enforced by the backend.
              </div>
            </section>

            <section
              className="sd-panel sd-activity-panel"
              id="sd-recent-activity"
            >
              <div className="sd-panel-heading">
                <div>
                  <span className="sd-section-kicker">AUDIT TRAIL</span>
                  <h2>Recent activity</h2>
                </div>

                <span className="sd-panel-badge">
                  {error ? "—" : `${activities.length} EVENTS`}
                </span>
              </div>

              <div className="sd-activity-controls">
                <label className="sd-search">
                  <Search size={16} />

                  <input
                    type="search"
                    placeholder="Search activity…"
                    value={activitySearch}
                    onChange={(event) =>
                      setActivitySearch(event.target.value)
                    }
                    aria-label="Search administrative activity"
                  />

                  {activitySearch && (
                    <button
                      type="button"
                      onClick={() => setActivitySearch("")}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>

                <div
                  className="sd-filter-tabs"
                  aria-label="Activity category"
                >
                  {(
                    [
                      ["all", "All"],
                      ["users", "Users"],
                      ["admins", "Admins"],
                      ["curriculum", "Curriculum"],
                    ] as [ActivityFilter, string][]
                  ).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={
                        activityFilter === value ? "is-active" : ""
                      }
                      onClick={() => setActivityFilter(value)}
                      aria-pressed={activityFilter === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="sd-activity-empty">
                  <RefreshCw size={20} className="sd-spin" />
                  <strong>Loading activity…</strong>
                  <span>
                    Fetching recent events from the dashboard API.
                  </span>
                </div>
              ) : filteredActivities.length > 0 ? (
                <div className="sd-activity-list">
                  {filteredActivities.slice(0, 8).map((item) => (
                    <article
                      className="sd-activity-item"
                      key={item.id}
                    >
                      <div className="sd-activity-icon">
                        <Clock3 size={16} />
                      </div>

                      <div className="sd-activity-copy">
                        <strong>{item.title}</strong>
                        <p>
                          {item.description ||
                            item.actorName ||
                            "Administrative event"}
                        </p>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>

                      <ArrowDownRight
                        size={15}
                        className="sd-activity-trail"
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="sd-activity-empty">
                  <div className="sd-empty-icon">
                    <Activity size={22} />
                  </div>

                  <strong>
                    {error
                      ? "Activity unavailable"
                      : activities.length === 0
                        ? "No activity loaded yet"
                        : "No matching events"}
                  </strong>

                  <span>
                    {error
                      ? "Check the dashboard API and audit log source."
                      : activities.length === 0
                        ? "The API should return a recentActivity array to populate this feed."
                        : "Try another search term or activity filter."}
                  </span>

                  {(activitySearch || activityFilter !== "all") && (
                    <button
                      type="button"
                      className="sd-clear-filters"
                      onClick={() => {
                        setActivitySearch("");
                        setActivityFilter("all");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>

          <section
            className="sd-system-strip sd-anchor-section"
            id="sd-system-information"
          >
            <div className="sd-system-title">
              <span className="sd-system-icon">
                <ShieldCheck size={18} />
              </span>

              <div>
                <strong>System information</strong>
                <span>Gradly ecosystem · Version 2</span>
              </div>
            </div>

            <div className="sd-system-item">
              <span>Database</span>
              <strong>
                {error ? "Unavailable" : loading ? "Checking…" : "Not separately verified"}
              </strong>
            </div>

            <div className="sd-system-item">
              <span>Environment</span>
              <strong>
                <span className="sd-env-dot" />
                {import.meta.env.MODE === "production" ? "Production" : "Development"}
              </strong>
            </div>

            <div className="sd-system-item">
              <span>Dashboard API</span>
              <strong className={error ? "sd-api-error" : ""}>
                {error
                  ? "Unavailable"
                  : loading
                    ? "Connecting…"
                    : "Responded"}
              </strong>
            </div>
          </section>

          <footer className="sd-footer">
            <span>GRADLY ECOSYSTEM</span>
            <span>Central administration · Protected workspace</span>
          </footer>
        </div>
      </div>
    </main>
  );
}