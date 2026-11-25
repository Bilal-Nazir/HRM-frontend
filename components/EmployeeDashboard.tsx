"use client";

import { useEffect, useRef, useState } from "react";
import CheckoutConfirmation from "@/components/CheckoutConfirmation";
import Link from "next/link";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import { captureAttendanceLocation, errorMessage } from "@/lib/workspace";
import AppShell from "@/components/AppShell";
import { EmptyState, ErrorBanner, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { captureAttendanceDevice } from "@/lib/attendanceDevice";
import { Attendance, Employee } from "@/types";
import { AttendanceInsights, AttendanceSummary, AttendanceLocation } from "@/components/AttendanceInsights";
import DashboardEngagement from "@/components/DashboardEngagement";
import AttendanceLocationReview from "@/components/AttendanceLocationReview";
import DailyWorkspace from "@/components/DailyWorkspace";
import DashboardQuote from "@/components/DashboardQuote";
import { attendanceClock } from "@/lib/attendanceClock";
import StandupForm, { type StandupInput, type StandupStatus } from "@/components/StandupForm";

function sessionDuration(session: Attendance | undefined, now: Date | null) {
  if (!session || !now) return "—";
  const start = new Date(session.checkInAt).getTime();
  const end = session.checkOutAt
    ? new Date(session.checkOutAt).getTime()
    : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function EmployeeDashboard() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance[] | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [standup, setStandup] = useState<StandupStatus | null>(null);
  const attendanceBusy = useRef(false);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors([]);
    Promise.allSettled([
      api.get<{ employee: Employee }>("/employee/me"),
      api.get<{ attendances: Attendance[] }>("/attendance/history?size=5"),
      api.get<{ totalCount: number }>(
        "/leave/requests/history?status=pending&size=1",
      ),
      api.get<AttendanceSummary>("/attendance/summary"),
    ]).then(([profile, sessions, pending, metrics]) => {
      if (cancelled) return;
      const failed: string[] = [];
      if (profile.status === "fulfilled") setEmployee(profile.value.employee);
      else failed.push("your profile");
      if (sessions.status === "fulfilled")
        setAttendance(sessions.value.attendances || []);
      else {
        setAttendance(null);
        failed.push("attendance");
      }
      if (pending.status === "fulfilled")
        setPendingCount(pending.value.totalCount);
      else {
        setPendingCount(null);
        failed.push("leave requests");
      }
      setSummary(metrics.status === "fulfilled" ? metrics.value : null);
      setErrors(failed);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const latest = attendance?.[0];
  const open = attendance?.find(
    (item) => !item.checkOutAt && ["open", "flagged"].includes(item.status),
  );
  const session = open || latest;
  const sessionState = loading
    ? "Loading…"
    : attendance === null
      ? "Unavailable"
      : open
        ? "Checked in"
        : latest
          ? "Checked out"
          : "No check-in yet";
  const recordAttendance = async (confirmed = false, report?: StandupInput) => {
    if (attendanceBusy.current || loading || attendance === null) return;
    if (confirmed && !open) {
      setConfirmCheckout(false);
      return;
    }
    setConfirmCheckout(false);
    attendanceBusy.current = true;
    setActionLoading(true);
    setActionError("");
    setActionSuccess("");
    try {
      if (!report) {
        const status = await api.get<StandupStatus>("/attendance/standup");
        if (open ? status.plan : status.enabled) {
          setStandup(status);
          return;
        }
        if (open && !confirmed) {
          setConfirmCheckout(true);
          return;
        }
      }
      const location = await captureAttendanceLocation();
      await api.post(
        open ? "/attendance/check-out" : "/attendance/check-in",
        { ...location, device: await captureAttendanceDevice().catch(() => ({})), standup: report },
      );
      setStandup(null);
      setActionSuccess(
        open
          ? "Checked out successfully. Your running task timers were paused."
          : "Checked in successfully. Your location was recorded.",
      );
      window.dispatchEvent(new Event("hrm:attendance-change"));
      localStorage.setItem("hrm_attendance_changed", String(Date.now()));
      setNow(new Date());
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setLoading(true);
      setReload((value) => value + 1);
      setActionLoading(false);
      attendanceBusy.current = false;
    }
  };

  return (
    <AppShell employee={employee}>
      {standup && <StandupForm plan={standup.plan} busy={actionLoading} submitError={actionError} onCancel={() => setStandup(null)} onSubmit={(report) => void recordAttendance(!!open, report)} />}
      {confirmCheckout && (
        <CheckoutConfirmation
          onCancel={() => setConfirmCheckout(false)}
          onConfirm={() => void recordAttendance(true)}
        />
      )}
      <div className="employee-dashboard" aria-busy={loading}>
        <header className="employee-welcome employee-welcome-compact">
          <div className="employee-welcome-copy">
            <div className="employee-welcome-topline">
              <span className={`employee-status-chip ${open ? "is-live" : ""}`}><i />{sessionState}</span>
              <DashboardEngagement audience="employee" compact />
            </div>
            <h1>
              {employee?.firstName
                ? `${now ? (now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening") : "Welcome back"}, ${employee.firstName}`
                : "Welcome back"}
              <span className="greeting-dot">.</span>
            </h1>
            <DashboardQuote compact />
          </div>
          <div className="employee-welcome-session">
            <div className="employee-session-clock">
              <span className="employee-session-label">{open ? "Current session" : "No active session"}</span>
              <strong role="timer" aria-live="off" aria-label="Current attendance session duration">{loading || attendance === null ? "—" : attendanceClock(open?.checkInAt, now)}</strong>
              <span className="employee-session-units">Hours : Minutes : Seconds</span>
            </div>
            <button
              type="button"
              className="button button-primary dashboard-check-button"
              onClick={() => void recordAttendance()}
              disabled={loading || attendance === null || actionLoading}
            >
              {actionLoading
                ? "Getting location…"
                : open
                  ? "Check out"
                  : "Check in"}
            </button>
          </div>
        </header>

        {actionError && (
          <div role="alert">
            <ErrorBanner message={actionError} />
          </div>
        )}
        {actionSuccess && (
          <div className="success-banner" role="status">
            {actionSuccess}
          </div>
        )}

        {errors.length > 0 && (
          <div className="employee-load-error">
            <ErrorBanner
              message={`Unable to load ${errors.join(", ")}. Please try again.`}
            />
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setReload((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}

        <DailyWorkspace now={now} />

        <section className="daily-attendance-strip" aria-label="Attendance and requests">
          <Link href="/attendance"><div><span>{open ? "Current attendance session" : "Last attendance session"}</span><strong>{sessionDuration(session, now)}</strong></div><small>{sessionState}</small></Link>
          <Link href="/leave"><div><span>Requests awaiting approval</span><strong>{loading || pendingCount === null ? "—" : pendingCount}</strong></div><small>View requests</small></Link>
        </section>
        <AnnouncementsPanel unreadOnly />
        <section className="dashboard-grid employee-overview">
          <div className="card employee-history">
            <div className="card-header">
              <div>
                <h2>Recent attendance</h2>
                <p>Your last five work sessions</p>
              </div>
              <Link href="/attendance" className="button button-secondary">
                View history
              </Link>
            </div>
            {loading ? (
              <div className="employee-loading" role="status">
                Loading your attendance…
              </div>
            ) : attendance === null ? (
              <EmptyState
                title="Attendance unavailable"
                description="Use Retry above to load your sessions again."
              />
            ) : attendance.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Check in</th>
                      <th>Check out</th>
                      <th>Hours</th>
                      <th>Location</th>
                      <th>Flags</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((item) => (
                      <tr key={item.id}>
                        <td>{item.workDate}</td>
                        <td>
                          {new Date(item.checkInAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </td>
                        <td>
                          {item.checkOutAt
                            ? new Date(item.checkOutAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })
                            : "In progress"}
                        </td>
                        <td>{sessionDuration(item, now)}</td>
                        <td><AttendanceLocation record={item} /></td>
                        <td>{item.flags?.length ? <span className="attendance-flags">{item.flags.join(", ").replaceAll("_", " ")}</span> : "—"}</td>
                        <td>
                          <StatusPill value={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="A fresh start"
                description="Your work sessions will appear here after your first check-in."
              />
            )}
          </div>
        </section>
        <details className="card daily-year-summary"><summary>Attendance trends and yearly summary</summary><AttendanceInsights summary={summary} /></details>
        <div className="daily-location-support">
        <AttendanceLocationReview assistance={!!actionError} action={open ? "check_out" : "check_in"} onRecorded={() => { setReload((value) => value + 1); setActionError(""); setActionSuccess("Admin confirmed your location and recorded attendance."); }}/>
        </div>
      </div>
    </AppShell>
  );
}
