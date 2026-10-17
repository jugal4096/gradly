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
import "./SuperAdminApplications.css";

const configuredApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

const API_BASE_URL = `${configuredApiBaseUrl}/api`;

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

function getToken(): string | null {
  try {
    return localStorage.getItem("gradly_super_admin_token");
  } catch {
    return null;
  }
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
  const [status, setStatus] = useState<ApplicationFilter>("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Application | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [approvedPermissions, setApprovedPermissions] = useState<string[]>([]);
  const [configurationLoading, setConfigurationLoading] = useState(false);
  const [configurationSaving, setConfigurationSaving] = useState(false);
  const [configurationSaved, setConfigurationSaved] = useState(false);

  const selectedInstitution = useMemo(
    () => institutions.find((institution) => institution.id === selected?.institution_id),
    [institutions, selected?.institution_id]
  );

  const availableBranches = useMemo(
    () => selectedInstitution?.branches.filter((branch) => branch.active !== false) ?? [],
    [selectedInstitution]
  );

  // Load applications from the backend.
  const loadApplications = useCallback(
    async (showLoading = true) => {
      const token = getToken();

      if (!token) {
        setApplications([]);
        setSelected(null);
        setLoading(false);
        setError("Your Super Admin session is missing. Please sign in again.");
        return;
      }

      try {
        if (showLoading) setLoading(true);
        setError("");

        const query =
          status === "ALL" ? "" : `?status=${encodeURIComponent(status)}`;

        const response = await fetch(
          `${API_BASE_URL}/super-admin/applications${query}`,
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
            getErrorMessage(data, `Unable to load applications. HTTP ${response.status}.`)
          );
        }

        const records = Array.isArray(data?.applications)
          ? data.applications
          : Array.isArray(data?.data)
            ? data.data
            : null;

        if (!records) {
          throw new Error("The server returned an unexpected application list.");
        }

        setApplications(records);
        setSelected((previous) =>
          previous ? records.find((item) => item.id === previous.id) ?? null : null
        );
      } catch (err) {
        console.error("Unable to load applications:", err);
        setError(err instanceof Error ? err.message : "Unable to load applications.");
      } finally {
        setLoading(false);
      }
    },
    [status]
  );

  // Load institutions and their departments.
  const loadInstitutions = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setConfigurationLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/academic/institutions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await readResponse<Institution[]>(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, `Unable to load institutions. HTTP ${response.status}.`)
        );
      }

      const records = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.institutions)
          ? data.institutions
          : null;

      if (!records) throw new Error("Institution API did not return an array.");
      setInstitutions(records);
    } catch (err) {
      console.error("Unable to load institutions:", err);
      setError(err instanceof Error ? err.message : "Unable to load institutions.");
    } finally {
      setConfigurationLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
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
    const token = getToken();

    if (!token) {
      setError("Your Super Admin session is missing. Please sign in again.");
      return false;
    }
    if (!departmentId) {
      setError("Select a department before saving.");
      return false;
    }
    if (approvedPermissions.length === 0) {
      setError("Select at least one permission before saving.");
      return false;
    }
    if (
      !selectedInstitution ||
      !availableBranches.some((branch) => branch.id === departmentId)
    ) {
      setError("The selected department does not belong to this applicant's institution.");
      return false;
    }

    try {
      setConfigurationSaving(true);
      setError("");
      setNotice("");

      const response = await fetch(
        `${API_BASE_URL}/super-admin/applications/${encodeURIComponent(selected.id)}/configuration`,
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
          getErrorMessage(data, `Unable to save configuration. HTTP ${response.status}.`)
        );
      }

      setConfigurationSaved(true);
      setNotice("Department and permissions saved.");
      await loadApplications(false);
      return true;
    } catch (err) {
      console.error("Unable to save application configuration:", err);
      setError(err instanceof Error ? err.message : "Unable to save configuration.");
      return false;
    } finally {
      setConfigurationSaving(false);
    }
  }

  // Accept, reject, or block an application.
  async function performAction(action: "accept" | "reject" | "block") {
    if (!selected) return;
    const token = getToken();

    if (!token) {
      setError("Your Super Admin session is missing. Please sign in again.");
      return;
    }

    if ((action === "reject" || action === "block") && !reason.trim()) {
      setError(
        action === "reject"
          ? "Enter a rejection reason."
          : "Enter a reason for blocking this applicant."
      );
      return;
    }

    // Blocking requires its own dedicated backend workflow.
    if (action === "block") {
      setError("Blocking is not supported by the current review API.");
      return;
    }

    if (action === "accept") {
      if (!departmentId || approvedPermissions.length === 0) {
        setError("Choose a department and at least one permission before accepting.");
        return;
      }
      if (
        !selectedInstitution ||
        !availableBranches.some((branch) => branch.id === departmentId)
      ) {
        setError("Select a valid department belonging to this institution.");
        return;
      }
      if (!configurationSaved && !(await saveConfiguration())) return;
    }

    const decision: ReviewDecision = action === "accept" ? "ACCEPTED" : "REJECTED";
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

      const payload =
        decision === "ACCEPTED"
          ? { decision, branchId: departmentId, permissions: approvedPermissions }
          : { decision, rejection_reason: reason.trim() };

      const response = await fetch(
        `${API_BASE_URL}/super-admin/applications/${encodeURIComponent(selected.id)}/review`,
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
          getErrorMessage(data, `Unable to ${action} the application. HTTP ${response.status}.`)
        );
      }

      setSelected(null);
      setReason("");
      setDepartmentId("");
      setApprovedPermissions([]);
      setConfigurationSaved(false);
      setNotice(
        action === "accept"
          ? "Application accepted successfully."
          : "Application rejected successfully."
      );
      await loadApplications(false);
    } catch (err) {
      console.error(`Unable to ${action} application:`, err);
      setError(err instanceof Error ? err.message : `Unable to ${action} application.`);
    } finally {
      setActionLoading(false);
    }
  }

  // Render the application review interface.
  return (
    <section className="super-admin-applications">
      <header className="applications-header">
        <div>
          <h1>Administrator applications</h1>
          <p>Review applications and configure access before approval.</p>
        </div>
        <button type="button" onClick={() => void loadApplications()} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {error && <div className="applications-alert applications-alert-error" role="alert"><AlertTriangle size={16} />{error}</div>}
      {notice && <div className="applications-alert applications-alert-success" role="status"><CheckCircle2 size={16} />{notice}</div>}

      <div className="applications-toolbar">
        <label>
          Filter
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ApplicationFilter)}
          >
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p>Loading applications…</p>
      ) : applications.length === 0 ? (
        <p>No applications found for this filter.</p>
      ) : (
        <div className="applications-content">
          <div className="applications-list">
            {applications.map((application) => (
              <button
                type="button"
                key={application.id}
                className={`application-list-item ${selected?.id === application.id ? "selected" : ""}`}
                onClick={() => selectApplication(application)}
              >
                <span className="application-list-item-main">
                  <strong>{application.full_name}</strong>
                  <span>{application.email}</span>
                  <small>{application.institution_name ?? "Institution not specified"}</small>
                </span>
                <span className={`application-status application-status-${statusClass(application.status)}`}>
                  <StatusIcon status={application.status} />
                  {statusLabel(application.status)}
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>

          {selected && (
            <article className="application-review-panel">
              <header>
                <div>
                  <h2>{selected.full_name}</h2>
                  <p>{selected.email}</p>
                </div>
                <span className={`application-status application-status-${statusClass(selected.status)}`}>
                  <StatusIcon status={selected.status} />
                  {statusLabel(selected.status)}
                </span>
              </header>

              <dl>
                <div><dt>Enrollment number</dt><dd>{selected.enrollment_number || "Not provided"}</dd></div>
                <div><dt>Mobile</dt><dd>{selected.mobile_number || "Not provided"}</dd></div>
                <div><dt>Institution</dt><dd>{selected.institution_name || "Not provided"}</dd></div>
                <div><dt>Branch</dt><dd>{selected.branch_name || "Not provided"}</dd></div>
                <div><dt>Graduation date</dt><dd>{formatDate(selected.graduation_date)}</dd></div>
                <div><dt>Submitted</dt><dd>{formatDateTime(selected.created_at)}</dd></div>
              </dl>

              {isReviewable(selected.status) && (
                <>
                  <section className="application-configuration">
                    <h3>Access configuration</h3>
                    <label>
                      Department / branch
                      <select
                        value={departmentId}
                        onChange={(event) => {
                          setDepartmentId(event.target.value);
                          setConfigurationSaved(false);
                        }}
                        disabled={configurationLoading || configurationSaving || actionLoading}
                      >
                        <option value="">Select department</option>
                        {(selectedInstitution?.branches ?? []).map((branch) => (
                          <option key={branch.id} value={branch.id} disabled={branch.active === false}>
                            {branch.name}{branch.code ? ` (${branch.code})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <fieldset disabled={configurationSaving || actionLoading}>
                      <legend>Permissions</legend>
                      {ADMIN_PERMISSION_OPTIONS.map((permission) => (
                        <label key={permission.code} className="permission-option">
                          <input
                            type="checkbox"
                            checked={approvedPermissions.includes(permission.code)}
                            onChange={(event) => {
                              setApprovedPermissions((previous) =>
                                event.target.checked
                                  ? [...previous, permission.code]
                                  : previous.filter((item) => item !== permission.code)
                              );
                              setConfigurationSaved(false);
                            }}
                          />
                          <span>
                            <strong>{permission.label}</strong>
                            <small>{permission.description}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>

                    <button
                      type="button"
                      onClick={() => void saveConfiguration()}
                      disabled={configurationSaving || actionLoading || configurationLoading}
                    >
                      <Save size={16} />
                      {configurationSaving ? "Saving…" : "Save configuration"}
                    </button>
                  </section>

                  <label className="application-rejection-reason">
                    Rejection reason
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={3}
                      placeholder="Required when rejecting this application"
                      disabled={actionLoading}
                    />
                  </label>

                  <footer className="application-review-actions">
                    <button
                      type="button"
                      onClick={() => void performAction("accept")}
                      disabled={actionLoading || configurationSaving || configurationLoading}
                    >
                      <CheckCircle2 size={16} />
                      {actionLoading ? "Processing…" : "Accept application"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void performAction("reject")}
                      disabled={actionLoading || configurationSaving}
                    >
                      <XCircle size={16} />
                      Reject application
                    </button>
                    <button
                      type="button"
                      onClick={() => void performAction("block")}
                      disabled={actionLoading || configurationSaving}
                    >
                      <ShieldBan size={16} />
                      Block applicant
                    </button>
                  </footer>
                </>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
