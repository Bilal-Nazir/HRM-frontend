"use client";
import { useRef, useState } from "react";
import { LeaveRequest } from "@/types";
import { useLiveData } from "@/lib/useLiveData";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";
import { EmptyState, ErrorBanner, StatusPill } from "@/components/ui";

function initials(name?: string) {
  if (!name) return "--";
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "--";
}
type LeaveOverview = {
  leaveRequests: LeaveRequest[];
  totalCount: number;
  lastPage: number;
};

export default function AdminLeave() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const { data, error, refresh } = useLiveData<LeaveOverview>(
    `/leave/requests/manage?size=20&page=${page}${status ? "&status=" + status : ""}`,
  );
  const review = async (id: string, decision: "approved" | "rejected") => {
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    setActionError("");
    setSuccess("");
    try {
      await api.patch(`/leave/requests/${id}/review`, { status: decision });
      setSuccess(`Request ${decision}.`);
      refresh();
      window.dispatchEvent(new Event("focus"));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      locked.current = false;
      setSaving(false);
    }
  };
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Employee requests</h2>
          <p>
            Leave and Work-from-Home requests appear here automatically · refreshes every 30 seconds
          </p>
        </div>
        <div className="admin-table-actions">
          <select
            aria-label="Leave status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="">All requests</option>
          </select>
          <button className="button button-secondary" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>
      {(error || actionError) && <ErrorBanner message={actionError || error} />}
      {success && (
        <div className="success-banner" role="status">
          {success}
        </div>
      )}
      {!data && !error && (
        <p className="panel-message">Loading leave requests…</p>
      )}
      {data &&
        !error &&
        (!data.leaveRequests.length ? (
          <EmptyState
            title="No requests to show"
            description="Employee requests will appear here for review."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Request type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status / action</th>
                </tr>
              </thead>
              <tbody>
                {data.leaveRequests.map((item) => (
                  <tr key={item.id} className={item.status === "pending" ? "row-pending" : undefined}>
                    <td>
                      <div className="person-cell">
                        <div className="avatar">{initials(item.employee?.name)}</div>
                        <div>
                          <strong>{item.employee?.name || "Employee unavailable"}</strong>
                          <span>{item.employee?.employeeCode}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.leaveTypeName}</td>
                    <td>
                      {item.startDate.slice(0, 10)} –{" "}
                      {item.endDate.slice(0, 10)}
                    </td>
                    <td>{item.totalDays}</td>
                    <td>{item.reason || "—"}</td>
                    <td>
                      {item.status === "pending" ? (
                        <div className="admin-table-actions">
                          <button
                            disabled={saving}
                            className="button button-primary"
                            onClick={() => review(item.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            disabled={saving}
                            className="button button-secondary"
                            onClick={() => review(item.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <StatusPill value={item.status} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {data && data.lastPage > 1 && (
        <div className="modal-actions">
          <button
            className="button button-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {data.lastPage}
          </span>
          <button
            className="button button-secondary"
            disabled={page >= data.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
