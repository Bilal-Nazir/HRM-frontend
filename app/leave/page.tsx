"use client";

import AppShell from "@/components/AppShell";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  StatusPill,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { errorMessage } from "@/lib/workspace";
import { LeaveRequest, LeaveType } from "@/types";
import { Check, Plus, X, XCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

export default function LeavePage() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  const [typesError, setTypesError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setTypesError("");
    const results = await Promise.allSettled([
      api.get<{ leaveTypes: LeaveType[] }>("/leave/types"),
      api.get<{ leaveRequests: LeaveRequest[] }>(
        "/leave/requests/history?size=100",
      ),
      getSession()?.permissions.some((p) => p === "*" || p === "leave.approve")
        ? api.get<{ leaveRequests: LeaveRequest[] }>("/leave/requests/pending")
        : Promise.resolve({ leaveRequests: [] as LeaveRequest[] }),
    ]);
    if (results[0].status === "fulfilled")
      setTypes(results[0].value.leaveTypes || []);
    else {
      setTypes([]);
      setTypesError(errorMessage(results[0].reason));
    }
    if (results[1].status === "fulfilled")
      setRequests(results[1].value.leaveRequests || []);
    if (results[2].status === "fulfilled")
      setPending(results[2].value.leaveRequests || []);
    if (results[1].status === "rejected")
      setError(
        results[1].reason instanceof ApiError
          ? results[1].reason.message
          : "Could not load leave history",
      );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/leave/requests", form);
      setModal(false);
      setForm({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
      await load();
      setSuccess(
        "Leave request submitted. Your admin has been notified in their review queue.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const review = async (id: string, status: "approved" | "rejected") => {
    try {
      await api.patch(`/leave/requests/${id}/review`, { status });
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not review request",
      );
    }
  };

  const typeName = (id: string) =>
    types.find((type) => type.id === id)?.name || "Leave";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Time away"
        title="Leave management"
        description="Plan time off, follow request progress, and review team leave."
        action={
          <button
            className="button button-primary"
            onClick={() => setModal(true)}
          >
            <Plus size={17} />
            Request leave
          </button>
        }
      />
      {error && !modal && <ErrorBanner message={error} />}
      {typesError && (
        <ErrorBanner message={`Could not load leave types: ${typesError}`} />
      )}
      {success && (
        <div className="success-banner" role="status">
          {success}
        </div>
      )}
      {pending.length > 0 && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <h2>Awaiting your review</h2>
              <p>Requests submitted by your direct reports</p>
            </div>
            <span className="status-pill status-pending">
              {pending.length} pending
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item) => (
                  <tr key={item.id}>
                    <td>{item.employeeId}</td>
                    <td>{typeName(item.leaveTypeId)}</td>
                    <td>
                      {new Date(item.startDate).toLocaleDateString()} –{" "}
                      {new Date(item.endDate).toLocaleDateString()}
                    </td>
                    <td>{item.totalDays}</td>
                    <td>
                      <div style={{ display: "flex", gap: 7 }}>
                        <button
                          className="button button-primary"
                          onClick={() => review(item.id, "approved")}
                        >
                          <Check size={15} />
                          Approve
                        </button>
                        <button
                          className="button button-secondary"
                          onClick={() => review(item.id, "rejected")}
                        >
                          <XCircle size={15} />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card">
        <div className="card-header">
          <div>
            <h2>Your leave history</h2>
            <p>Requests and their current approval status</p>
          </div>
        </div>
        {loading && <div className="loading-line" />}
        {!loading && requests.length === 0 ? (
          <EmptyState
            title="No leave requests"
            description="When you need time away, submit a request and track it here."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Leave type</th>
                  <th>Start date</th>
                  <th>End date</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{typeName(item.leaveTypeId)}</strong>
                    </td>
                    <td>{new Date(item.startDate).toLocaleDateString()}</td>
                    <td>{new Date(item.endDate).toLocaleDateString()}</td>
                    <td>{item.totalDays}</td>
                    <td>{item.reason || "—"}</td>
                    <td>
                      <StatusPill value={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={submit}>
            <div className="modal-header">
              <div>
                <h2>Request leave</h2>
                <p>Choose the leave type and dates for your request.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {error && <ErrorBanner message={error} />}
              {typesError && (
                <ErrorBanner
                  message={`Could not load leave types: ${typesError}`}
                />
              )}
              {!loading && !typesError && types.length === 0 && (
                <ErrorBanner message="No leave types are configured yet. Ask your admin to restart the backend to initialize the default types." />
              )}
              {(typesError || (!loading && types.length === 0)) && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={load}
                >
                  Retry leave types
                </button>
              )}
              <div className="form-grid">
                <div className="field full">
                  <label htmlFor="leave-type">Leave type</label>
                  <select
                    id="leave-type"
                    disabled={loading || !!typesError || !types.length}
                    required
                    value={form.leaveTypeId}
                    onChange={(e) =>
                      setForm({ ...form, leaveTypeId: e.target.value })
                    }
                  >
                    <option value="">Select leave type</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                        {type.annualAllowanceDays
                          ? ` · ${type.annualAllowanceDays} days/year`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="leave-start">Start date</label>
                  <input
                    id="leave-start"
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="leave-end">End date</label>
                  <input
                    id="leave-end"
                    type="date"
                    required
                    min={form.startDate}
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                  />
                </div>
                <div className="field full">
                  <label htmlFor="leave-reason">Reason</label>
                  <textarea
                    id="leave-reason"
                    placeholder="Add a short note for your manager"
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={saving || loading || !!typesError || !types.length}
              >
                {saving ? "Submitting..." : "Submit request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
