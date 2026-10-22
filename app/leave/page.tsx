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
  const [balances, setBalances] = useState<{ name: string; allowanceDays: number; usedDays: number; pendingDays: number; remainingDays: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  const [typesError, setTypesError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    requestKind: "leave",
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
      api.get<{ leaveBalances: typeof balances }>("/leave/balances"),
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
    if (results[3].status === "fulfilled") setBalances(results[3].value.leaveBalances || []);
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
      setForm({ requestKind: "leave", leaveTypeId: "", startDate: "", endDate: "", reason: "" });
      await load();
      setSuccess(
        "Request submitted. Your admin can review it in their approval queue.",
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
  const requestName = (item: LeaveRequest) => item.requestKind === "work_from_home" ? "Work from Home" : item.leaveTypeName || typeName(item.leaveTypeId || "");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Time away and flexible work"
        title="Requests"
        description="Request leave or work from home and follow approval progress."
        action={
          <button
            className="button button-primary"
            onClick={() => setModal(true)}
          >
            <Plus size={17} />
            New request
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
      <section className="card" style={{ marginBottom: 20 }}><div className="card-header"><div><h2>Leave balance</h2><p>Annual allowance less approved leave; pending requests are shown separately.</p></div></div><div className="leave-balance-grid">{balances.map((balance) => <div key={balance.name}><strong>{balance.remainingDays} days</strong><span>{balance.name} remaining</span><small>{balance.usedDays} used · {balance.pendingDays} pending · {balance.allowanceDays} annual</small></div>)}{!balances.length && <p>No leave allowances configured yet.</p>}</div></section>
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
                    <td>
                      <div className="person-cell">
                        <div className="avatar">{(item.employee?.name || "").trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "--"}</div>
                        <div>
                          <strong>{item.employee?.name || "Employee"}</strong>
                          <span>{item.employee?.employeeCode}</span>
                        </div>
                      </div>
                    </td>
                    <td>{requestName(item)}</td>
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
                      <strong>{requestName(item)}</strong>
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
                <h2>New request</h2>
                <p>Choose leave or work from home, then select your dates.</p>
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
                <div className="field full"><label htmlFor="request-kind">Request type</label><select id="request-kind" value={form.requestKind} onChange={(e) => setForm({ ...form, requestKind: e.target.value, leaveTypeId: "" })}><option value="leave">Leave</option><option value="work_from_home">Work from Home</option></select></div>
                {form.requestKind === "leave" && (
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
                )}
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
