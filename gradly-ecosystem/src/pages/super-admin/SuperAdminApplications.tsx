import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RefreshCw,
  Save,
  ShieldBan,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL as API_ORIGIN, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import { clearToken, getToken } from "../../lib/superAdminSession";
import "./SuperAdminApplications.css";

const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : "";

const ADMIN_PERMISSION_OPTIONS = [
  {
    code: "VIEW_STUDENTS",
    label: "View students",
    description: "Read student records.",
  },
  {
    code: "MANAGE_STUDENTS",
    label: "Manage students",
    description: "Create or update student records.",
  },
  {
    code: "VIEW_ACADEMICS",
    label: "View academics",
    description: "View academic and semester information.",
  },
  {
    code: "MANAGE_ACADEMICS",
    label: "Manage academics",
    description: "Manage academic information.",
  },
  {
    code: "VIEW_REPORTS",
    label: "View reports",
    description: "Access institution and department reports.",
  },
  {
    code: "MANAGE_ANNOUNCEMENTS",
    label: "Manage announcements",
    description: "Publish and update announcements.",
  },
] as const;

type ApplicationStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "ACCEPTED"
  | "APPROVED"
  | "REJECTED"
  | "REGISTRATION_IN_PROGRESS"
  | "REGISTRATION_SUCCESSFUL"
  | "ACTIVE"
  | "BLOCKED";

type ApplicationFilter = "PENDING" | "ACCEPTED" | "REJECTED" | "ALL";
type ReviewDecision = "ACCEPTED" | "REJECTED" | "BLOCKED";

interface Branch {
  id: string;
  name: string;
  code?: string | null;
  active?: boolean;
}

interface Institution {
  id: string;
  name: string;
  branches: Branch[];
}

interface Application {
  id: string;
  user_id?: string | null;
  full_name: string;
  enrollment_number: string;
  mobile_number: string;
  email: string;
  graduation_date: string | null;
  status: ApplicationStatus;
  institution_id?: string | null;
  institution_name: string | null;
  branch_id?: string | null;
  branch_name: string | null;
  approved_permissions?: string[] | null;
  created_at: string;
  rejection_reason?: string | null;
  review_comment?: string | null;
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  error?: string;
  applications?: T;
  institutions?: T;
  data?: T;
}

function getErrorMessage(
  data: ApiResponse<unknown> | null,
  fallback: string
): string {
  return data?.message || data?.error || fallback;
}

async function readResponse<T>(
  response: Response
): Promise<ApiResponse<T> | null> {
  return (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | null;
}

function formatDate(value?: string | null): string {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function statusLabel(status: ApplicationStatus): string {
  const labels: Record<ApplicationStatus, string> = {
    PENDING: "Pending",
    UNDER_REVIEW: "Under Review",
    ACCEPTED: "Accepted",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    REGISTRATION_IN_PROGRESS: "Registration in Progress",
    REGISTRATION_SUCCESSFUL: "Registration Successful",
    ACTIVE: "Active",
    BLOCKED: "Blocked",
  };

  return labels[status] || status;
}

function statusClass(status: ApplicationStatus): string {
  if (
    [
      "ACCEPTED",
      "APPROVED",
      "ACTIVE",
      "REGISTRATION_SUCCESSFUL",
    ].includes(status)
  ) {
    return "accepted";
  }

  if (["REJECTED", "BLOCKED"].includes(status)) {
    return "rejected";
  }

  return "pending";
}

function isReviewable(status: ApplicationStatus): boolean {
  return status === "PENDING" || status === "UNDER_REVIEW";
}

function StatusIcon({
  status,
}: {
  status: ApplicationStatus;
}) {
  if (isReviewable(status)) {
    return <Clock3 size={15} />;
  }

  if (
    [
      "ACCEPTED",
      "APPROVED",
      "ACTIVE",
      "REGISTRATION_IN_PROGRESS",
      "REGISTRATION_SUCCESSFUL",
    ].includes(status)
  ) {
    return <CheckCircle2 size={15} />;
  }

  return <XCircle size={15} />;
}

export default function SuperAdminApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] =
    useState<ApplicationFilter>("PENDING");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selected, setSelected] = useState<Application | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reason, setReason] = useState("");

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [approvedPermissions, setApprovedPermissions] =
    useState<string[]>([]);

  const [configurationLoading, setConfigurationLoading] =
    useState(false);

  const [configurationSaving, setConfigurationSaving] =
    useState(false);

  const [configurationSaved, setConfigurationSaved] =
    useState(false);

  const selectedInstitution = useMemo(
    () =>
      institutions.find(
        (institution) =>
          institution.id === selected?.institution_id
      ),
    [institutions, selected?.institution_id]
  );

  const availableBranches = useMemo(
    () =>
      selectedInstitution?.branches.filter(
        (branch) => branch.active !== false
      ) ?? [],
    [selectedInstitution]
  );

  // Load applications from the backend.
  const loadApplications = useCallback(
    async (showLoading = true) => {
      if (!isApiConfigured) {
        setError(API_CONFIGURATION_ERROR);
        setLoading(false);
        return;
      }
      const token = getToken();

      if (!token) {
        setApplications([]);
        setSelected(null);
        setLoading(false);
        setError(
          "Your Super Admin session is missing. Please sign in again."
        );
        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        }

        setError("");

        const query =
          status === "ALL"
            ? ""
            : `?status=${encodeURIComponent(status)}`;

        const response = await fetch(
          `${API_BASE_URL}/super-admin/applications${query}`,
        if (response.status === 401 || response.status === 403) {
          clearToken();
          window.location.assign("/super-admin/login");
          return;
        }

          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        const data = await readResponse<Application[]>(response);

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              data,
              `Unable to load applications. HTTP ${response.status}.`
            )
          );
        }

        const records = Array.isArray(data?.applications)
          ? data.applications
          : Array.isArray(data?.data)
            ? data.data
            : null;

        if (!records) {
          throw new Error(
            "The server returned an unexpected application list."
          );
        }

        setApplications(records);

        setSelected((previous) => {
          if (!previous) return null;

          return (
            records.find((item) => item.id === previous.id) ??
            null
          );
        });
      } catch (err) {
        console.error("Unable to load applications:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load applications."
        );
      } finally {
        setLoading(false);
      }
    },
    [status]
  );

  // Load institutions and their departments.
  const loadInstitutions = useCallback(async () => {
    if (!isApiConfigured) {
      setError(API_CONFIGURATION_ERROR);
      setConfigurationLoading(false);
      return;
    }
    const token = getToken();

    if (!token) return;

    setConfigurationLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/academic/institutions`,
      if (response.status === 401 || response.status === 403) {
        clearToken();
        window.location.assign("/super-admin/login");
        return;
      }

        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      const data = await readResponse<Institution[]>(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            `Unable to load institutions. HTTP ${response.status}.`
          )
        );
      }

      const records = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.institutions)
          ? data.institutions
          : null;

      if (!records) {
        throw new Error(
          "Institution API did not return an array."
        );
      }

      setInstitutions(records);
    } catch (err) {
      console.error("Unable to load institutions:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load institutions."
      );
    } finally {
      setConfigurationLoading(false);
    }
  }, []);

  // These effects start asynchronous API requests; state updates happen after the requests settle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInstitutions();
  }, [loadInstitutions]);

  // Select an application to review.
  function selectApplication(application: Application) {
    setSelected(application);
    setReason("");
    setError("");
    setNotice("");
    setDepartmentId(application.branch_id || "");

    setApprovedPermissions(
      Array.isArray(application.approved_permissions)
        ? application.approved_permissions
        : []
    );

    setConfigurationSaved(false);
  }

  // Save the selected department and permissions.
  async function saveConfiguration(): Promise<boolean> {
    if (!selected) return false;
    if (!isApiConfigured) {
      setError(API_CONFIGURATION_ERROR);
      return false;
    }

    const token = getToken();

    if (!token) {
      setError(
        "Your Super Admin session is missing. Please sign in again."
      );
      return false;
    }

    if (!departmentId) {
      setError("Select a department before saving.");
      return false;
    }

    if (approvedPermissions.length === 0) {
      setError(
        "Select at least one permission before saving."
      );
      return false;
    }

    if (
      !selectedInstitution ||
      !availableBranches.some(
        (branch) => branch.id === departmentId
      )
    ) {
      setError(
        "The selected department does not belong to this applicant's institution."
      );
      return false;
    }

    try {
      setConfigurationSaving(true);
      setError("");
      setNotice("");

      const response = await fetch(
        `${API_BASE_URL}/super-admin/applications/${encodeURIComponent(
          selected.id
        )}/configuration`,
      if (response.status === 401 || response.status === 403) {
        clearToken();
        window.location.assign("/super-admin/login");
        return false;
      }

        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            branchId: departmentId,
            approvedPermissions,
          }),
        }
      );

      const data = await readResponse<unknown>(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            `Unable to save configuration. HTTP ${response.status}.`
          )
        );
      }

      setConfigurationSaved(true);
      setNotice("Department and permissions saved.");

      await loadApplications(false);

      return true;
    } catch (err) {
      console.error(
        "Unable to save application configuration:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save configuration."
      );

      return false;
    } finally {
      setConfigurationSaving(false);
    }
  }

  // Accept, reject, or block an application.
  async function performAction(
    action: "accept" | "reject" | "block"
  ) {
    if (!selected) return;
    if (!isApiConfigured) {
      setError(API_CONFIGURATION_ERROR);
      return;
    }

    const token = getToken();

    if (!token) {
      setError(
        "Your Super Admin session is missing. Please sign in again."
      );
      return;
    }

    if (
      (action === "reject" || action === "block") &&
      !reason.trim()
    ) {
      setError(
        action === "reject"
          ? "Enter a rejection reason."
          : "Enter a reason for blocking this applicant."
      );
      return;
    }

    // The current backend review API supports only ACCEPTED and REJECTED.
    if (action === "block") {
      setError(
        "Blocking is not supported by the current review API. Use a dedicated blocking endpoint once it is implemented."
      );
      return;
    }

    if (action === "accept") {
      if (!departmentId || approvedPermissions.length === 0) {
        setError(
          "Choose a department and at least one permission before accepting."
        );
        return;
      }

      if (
        !selectedInstitution ||
        !availableBranches.some(
          (branch) => branch.id === departmentId
        )
      ) {
        setError(
          "Select a valid department belonging to this institution."
        );
        return;
      }

      // Persist the department and permissions before accepting.
      if (!configurationSaved) {
        const saved = await saveConfiguration();

        if (!saved) return;
      }
    }

    const decision: ReviewDecision =
      action === "accept" ? "ACCEPTED" : "REJECTED";

    const confirmed = window.confirm(
      action === "accept"
        ? "Accept this administrator application with the selected department and permissions?"
        : "Reject this administrator application?"
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError("");
      setNotice("");

      // IMPORTANT: The backend requires department and permissions
      // when accepting an application.
      const payload =
        decision === "ACCEPTED"
          ? {
              decision,
              branchId: departmentId,
              permissions: approvedPermissions,
            }
          : {
              decision,
              rejection_reason: reason.trim(),
            };

      const response = await fetch(
        `${API_BASE_URL}/super-admin/applications/${encodeURIComponent(
          selected.id
        )}/review`,
      if (response.status === 401 || response.status === 403) {
        clearToken();
        window.location.assign("/super-admin/login");
        return;
      }

        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await readResponse<unknown>(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            `Unable to ${action} the application. HTTP ${response.status}.`
          )
        );
      }

      setSelected(null);
      setReason("");
      setDepartmentId("");
      setApprovedPermissions([]);
      setConfigurationSaved(false);

      setNotice(
        action === "accept"
          ? "Application accepted."
          : "Application rejected."
      );

      await loadApplications(false);
    } catch (err) {
      console.error("Application review failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "The application review failed."
      );
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="super-applications">
      <div className="super-applications-header">
        <div>
          <div className="system-kicker">
            ADMINISTRATION SYSTEM
          </div>

          <h1>Administrator Applications</h1>

          <p>
            Review requests, assign a department, and grant
            approved permissions.
          </p>
        </div>

        <button
          type="button"
          className="hardware-button"
          onClick={() => {
            void loadApplications();
            void loadInstitutions();
          }}
          disabled={loading || actionLoading}
        >
          <RefreshCw
            size={16}
            className={loading ? "refresh-spinning" : ""}
          />

          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="application-tabs">
        {(
          [
            "PENDING",
            "ACCEPTED",
            "REJECTED",
            "ALL",
          ] as ApplicationFilter[]
        ).map((item) => (
          <button
            type="button"
            key={item}
            className={
              status === item
                ? "application-tab active"
                : "application-tab"
            }
            onClick={() => {
              setSelected(null);
              setReason("");
              setError("");
              setNotice("");
              setStatus(item);
            }}
            disabled={loading || actionLoading}
          >
            {item === "ALL"
              ? "All applications"
              : item.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {error && (
        <div className="application-error" role="alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="application-notice" role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
        </div>
      )}

      <div className="applications-workspace">
        <section className="application-list-panel">
          <div className="panel-title">
            <span>Applications</span>

            <span className="record-count">
              {applications.length}
            </span>
          </div>

          {loading ? (
            <div className="empty-state">
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="empty-state">
              No applications found.
            </div>
          ) : (
            <div className="application-list">
              {applications.map((application) => (
                <button
                  type="button"
                  key={application.id}
                  className={
                    selected?.id === application.id
                      ? "application-row selected"
                      : "application-row"
                  }
                  onClick={() => selectApplication(application)}
                >
                  <div className="application-avatar">
                    <UserRound size={19} />
                  </div>

                  <div className="application-summary">
                    <strong>
                      {application.full_name ||
                        "Unnamed applicant"}
                    </strong>

                    <span>
                      {application.enrollment_number ||
                        "No enrollment number"}
                    </span>

                    <small>
                      {application.branch_name ||
                        "Department not assigned"}
                    </small>
                  </div>

                  <div
                    className={`application-status ${statusClass(
                      application.status
                    )}`}
                  >
                    <StatusIcon status={application.status} />
                    {statusLabel(application.status)}
                  </div>

                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="application-details-panel">
          {!selected ? (
            <div className="details-empty">
              <UserRound size={42} />

              <h2>Select an application</h2>

              <p>
                Select an application from the list to inspect
                and configure the request.
              </p>
            </div>
          ) : (
            <>
              <div className="details-header">
                <div>
                  <div className="system-kicker">
                    APPLICATION RECORD
                  </div>

                  <h2>
                    {selected.full_name || "Unnamed applicant"}
                  </h2>

                  <p>
                    {selected.enrollment_number ||
                      "No enrollment number"}
                  </p>
                </div>

                <div
                  className={`large-status ${statusClass(
                    selected.status
                  )}`}
                >
                  <StatusIcon status={selected.status} />
                  {statusLabel(selected.status)}
                </div>
              </div>

              <div className="details-grid">
                <div>
                  <label>Institution</label>
                  <strong>
                    {selected.institution_name ||
                      "Institution information unavailable"}
                  </strong>
                </div>

                <div>
                  <label>Current department</label>
                  <strong>
                    {selected.branch_name || "Not assigned"}
                  </strong>
                </div>

                <div>
                  <label>Enrollment number</label>
                  <strong>
                    {selected.enrollment_number ||
                      "Not available"}
                  </strong>
                </div>

                <div>
                  <label>Mobile number</label>
                  <strong>
                    {selected.mobile_number || "Not available"}
                  </strong>
                </div>

                <div>
                  <label>Email</label>
                  <strong>
                    {selected.email || "Not available"}
                  </strong>
                </div>

                <div>
                  <label>Graduation date</label>
                  <strong>
                    {formatDate(selected.graduation_date)}
                  </strong>
                </div>

                <div>
                  <label>Application submitted</label>
                  <strong>
                    {formatDateTime(selected.created_at)}
                  </strong>
                </div>
              </div>

              {isReviewable(selected.status) && (
                <>
                  <div className="application-configuration">
                    <div className="configuration-heading">
                      <div>
                        <div className="system-kicker">
                          ACCESS CONFIGURATION
                        </div>

                        <h3>
                          Department &amp; permissions
                        </h3>

                        <p>
                          Choose the department and the exact
                          access this admin should receive.
                        </p>
                      </div>
                    </div>

                    <div className="configuration-field">
                      <label htmlFor="application-department">
                        Department / Branch
                      </label>

                      <select
                        id="application-department"
                        value={departmentId}
                        onChange={(event) => {
                          setDepartmentId(event.target.value);
                          setConfigurationSaved(false);
                          setError("");
                        }}
                        disabled={
                          configurationLoading ||
                          configurationSaving ||
                          actionLoading
                        }
                      >
                        <option value="">
                          Select a department
                        </option>

                        {availableBranches.map((branch) => (
                          <option
                            key={branch.id}
                            value={branch.id}
                          >
                            {branch.name}
                            {branch.code
                              ? ` (${branch.code})`
                              : ""}
                          </option>
                        ))}
                      </select>

                      {configurationLoading && (
                        <small>
                          Loading institution departments…
                        </small>
                      )}

                      {!configurationLoading &&
                        selected.institution_id &&
                        !selectedInstitution && (
                          <small className="field-warning">
                            Institution departments could not be
                            matched. Confirm the institution API
                            returns id, name, and branches.
                          </small>
                        )}

                      {!configurationLoading &&
                        selectedInstitution &&
                        availableBranches.length === 0 && (
                          <small className="field-warning">
                            No active departments were returned
                            for this institution.
                          </small>
                        )}
                    </div>

                    <div className="permissions-heading">
                      <div>
                        <h4>Approved permissions</h4>

                        <p>
                          Select only the capabilities this
                          administrator needs.
                        </p>
                      </div>

                      <span className="permission-count">
                        {approvedPermissions.length} selected
                      </span>
                    </div>

                    <div className="permission-options">
                      {ADMIN_PERMISSION_OPTIONS.map(
                        (permission) => (
                          <label
                            className="permission-option"
                            key={permission.code}
                          >
                            <input
                              type="checkbox"
                              checked={approvedPermissions.includes(
                                permission.code
                              )}
                              disabled={
                                configurationSaving ||
                                actionLoading
                              }
                              onChange={(event) => {
                                setApprovedPermissions(
                                  (previous) =>
                                    event.target.checked
                                      ? [
                                          ...new Set([
                                            ...previous,
                                            permission.code,
                                          ]),
                                        ]
                                      : previous.filter(
                                          (code) =>
                                            code !==
                                            permission.code
                                        )
                                );

                                setConfigurationSaved(false);
                                setError("");
                              }}
                            />

                            <span className="permission-copy">
                              <strong>
                                {permission.label}
                              </strong>

                              <small>
                                {permission.description}
                              </small>

                              <code>{permission.code}</code>
                            </span>
                          </label>
                        )
                      )}
                    </div>

                    <div className="configuration-footer">
                      <span
                        className={
                          configurationSaved
                            ? "save-state saved"
                            : "save-state"
                        }
                      >
                        {configurationSaved
                          ? "Configuration saved"
                          : "Save configuration before accepting"}
                      </span>

                      <button
                        type="button"
                        className="action-button save-configuration"
                        onClick={() =>
                          void saveConfiguration()
                        }
                        disabled={
                          configurationLoading ||
                          configurationSaving ||
                          actionLoading
                        }
                      >
                        <Save size={16} />

                        {configurationSaving
                          ? "Saving…"
                          : "Save configuration"}
                      </button>
                    </div>
                  </div>

                  <div className="application-action-area">
                    <div className="action-warning">
                      <AlertTriangle size={17} />

                      <span>
                        Acceptance requires a saved department
                        and permission configuration.
                      </span>
                    </div>

                    <div className="reason-box">
                      <label htmlFor="application-review-note">
                        Reason / administrative note
                      </label>

                      <textarea
                        id="application-review-note"
                        value={reason}
                        onChange={(event) => {
                          setReason(event.target.value);
                          setError("");
                        }}
                        placeholder="Required for rejection or blocking…"
                        disabled={actionLoading}
                      />
                    </div>

                    <div className="application-actions">
                      <button
                        type="button"
                        className="action-button accept"
                        disabled={
                          actionLoading ||
                          configurationSaving ||
                          configurationLoading
                        }
                        onClick={() =>
                          void performAction("accept")
                        }
                      >
                        <CheckCircle2 size={17} />

                        {actionLoading
                          ? "Processing…"
                          : "Accept"}
                      </button>

                      <button
                        type="button"
                        className="action-button reject"
                        disabled={
                          actionLoading || configurationSaving
                        }
                        onClick={() =>
                          void performAction("reject")
                        }
                      >
                        <XCircle size={17} />
                        Reject
                      </button>

                      <button
                        type="button"
                        className="action-button block"
                        disabled={
                          actionLoading || configurationSaving
                        }
                        onClick={() =>
                          void performAction("block")
                        }
                      >
                        <ShieldBan size={17} />
                        Permanently block
                      </button>
                    </div>
                  </div>
                </>
              )}

              {selected.status === "ACCEPTED" && (
                <div className="completed-notice accepted">
                  <CheckCircle2 size={20} />

                  <div>
                    <strong>Application accepted</strong>

                    <span>
                      The applicant can continue through the
                      administrator registration workflow.
                    </span>
                  </div>
                </div>
              )}

              {selected.status === "APPROVED" && (
                <div className="completed-notice accepted">
                  <CheckCircle2 size={20} />

                  <div>
                    <strong>Application approved</strong>

                    <span>
                      Registration must still be completed if
                      required by the backend workflow.
                    </span>
                  </div>
                </div>
              )}

              {selected.status ===
                "REGISTRATION_IN_PROGRESS" && (
                <div className="completed-notice accepted">
                  <Clock3 size={20} />

                  <div>
                    <strong>Registration in progress</strong>

                    <span>
                      The applicant is completing administrator
                      registration.
                    </span>
                  </div>
                </div>
              )}

              {selected.status ===
                "REGISTRATION_SUCCESSFUL" && (
                <div className="completed-notice accepted">
                  <CheckCircle2 size={20} />

                  <div>
                    <strong>Registration successful</strong>

                    <span>
                      The administrator registration workflow
                      has completed successfully.
                    </span>
                  </div>
                </div>
              )}

              {selected.status === "ACTIVE" && (
                <div className="completed-notice accepted">
                  <CheckCircle2 size={20} />

                  <div>
                    <strong>Administrator active</strong>

                    <span>
                      This application is associated with an
                      active administrator.
                    </span>
                  </div>
                </div>
              )}

              {selected.status === "REJECTED" && (
                <div className="completed-notice rejected">
                  <XCircle size={20} />

                  <div>
                    <strong>Application rejected</strong>

                    <span>
                      {selected.rejection_reason ||
                        selected.review_comment ||
                        "This application is no longer actionable."}
                    </span>
                  </div>
                </div>
              )}

              {selected.status === "BLOCKED" && (
                <div className="completed-notice rejected">
                  <ShieldBan size={20} />

                  <div>
                    <strong>Applicant blocked</strong>

                    <span>
                      This application is marked as blocked.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}