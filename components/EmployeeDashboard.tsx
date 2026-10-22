"use client";

import { useEffect, useRef, useState } from "react";
import CheckoutConfirmation from "@/components/CheckoutConfirmation";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarCheck2,
  Clock3,
  MapPin,
  Palmtree,
  Sun,
  LogIn,
  LogOut,
} from "lucide-react";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import { captureAttendanceLocation, errorMessage } from "@/lib/workspace";
import AppShell from "@/components/AppShell";
import { EmptyState, ErrorBanner, StatCard, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { Attendance, Employee } from "@/types";
import { AttendanceInsights, AttendanceSummary, AttendanceLocation } from "@/components/AttendanceInsights";
import DashboardEngagement from "@/components/DashboardEngagement";

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
  const locationState =
    session?.checkInWithinGeofence === true
      ? "Within office area"
      : session?.checkInWithinGeofence === false
        ? "Outside office area"
        : session?.checkInLocation ? "Location captured" : "Location unavailable";

  const recordAttendance = async (confirmed = false) => {
    if (attendanceBusy.current || loading || attendance === null) return;
    if (open && !confirmed) {
      setConfirmCheckout(true);
      return;
    }
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
      const location = await captureAttendanceLocation();
      await api.post(
        open ? "/attendance/check-out" : "/attendance/check-in",
        location,
      );
      setActionSuccess(
        open
          ? "Checked out successfully."
          : "Checked in successfully. Your location was recorded.",
      );
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
      {confirmCheckout && (
        <CheckoutConfirmation
          onCancel={() => setConfirmCheckout(false)}
          onConfirm={() => void recordAttendance(true)}
        />
      )}
      <div className="employee-dashboard" aria-busy={loading}>
        <header className="employee-welcome">
          <div className="employee-welcome-copy">
            <span className="eyebrow">Your workspace</span>
            <h1>
              {employee?.firstName
                ? `${now ? (now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening") : "Welcome back"}, ${employee.firstName}`
                : "Welcome back"}
              <span className="greeting-dot">.</span>
            </h1>
            <p>Your time, your leave, your day. All in one place.</p>
            <span className={`employee-status-chip ${open ? "is-live" : ""}`}>
              <i />
              {sessionState}
            </span>
          </div>
          <div className="employee-welcome-clock">
            <span className="employee-welcome-clock-label">Local time</span>
            <strong aria-label="Current local time">{now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</strong>
            <button
              type="button"
              className="button button-primary dashboard-check-button"
              onClick={() => void recordAttendance()}
              disabled={loading || attendance === null || actionLoading}
            >
              {open ? <LogOut size={17} /> : <LogIn size={17} />}
              {actionLoading
                ? "Getting location…"
                : open
                  ? "Check out"
                  : "Check in"}
            </button>
          </div>
        </header>

        <DashboardEngagement audience="employee" />

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

        <section
          className="stats-grid employee-stats"
          aria-label="Your activity summary"
        >
          <StatCard
            label="Attendance"
            value={sessionState}
            note={
              session
                ? `Latest session · ${session.workDate}`
                : "Start from the attendance page"
            }
            icon={<CalendarCheck2 size={20} />}
          />
          <StatCard
            label={open ? "Current session" : "Last session"}
            value={sessionDuration(session, now)}
            note={
              open
                ? "Time since your check-in"
                : "Your most recent work session"
            }
            icon={<Clock3 size={20} />}
          />
          <StatCard
            label="Leave awaiting approval"
            value={loading || pendingCount === null ? "—" : pendingCount}
            note="Your pending leave requests"
            icon={<Palmtree size={20} />}
          />
          <StatCard label="Working days" value={summary?.totalWorkingDays ?? "—"} note={`${summary?.totalWorkedHours.toFixed(1) ?? "—"} hours recorded this year`} icon={<CalendarCheck2 size={20} />} />
        </section>

        <AnnouncementsPanel />
        <AttendanceInsights summary={summary} />
        <section className="dashboard-grid employee-overview">
          <div className="card employee-history">
            <div className="card-header">
              <div>
                <span className="section-kicker">Your activity</span>
                <h2>Recent attendance</h2>
                <p>Your last five work sessions</p>
              </div>
              <Link href="/attendance" className="button button-secondary">
                View history
                <ArrowUpRight size={15} />
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
                          })}
                        </td>
                        <td>
                          {item.checkOutAt
                            ? new Date(item.checkOutAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
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
          <aside className="card employee-day-card">
            <div className="employee-day-top">
              <span className="eyebrow">Make today count</span>
              <Sun size={25} strokeWidth={1.5} />
            </div>
            <h2>
              {open ? "You’re on the clock." : "A little focus. A great day."}
            </h2>
            <p>
              {open
                ? "Your session is running. Check out when you finish."
                : "Check in when you’re ready, and we’ll keep track of your time."}
            </p>
            <div className="clock-display">
              {now
                ? now.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </div>
            <div className="clock-caption">
              {now
                ? now.toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Your local time"}
            </div>
            <Link
              href="/attendance"
              className="button button-primary button-block"
            >
              <CalendarCheck2 size={17} />
              {open ? "Manage check-out" : "Open attendance"}
              <ArrowUpRight size={16} />
            </Link>
            <div className="employee-location">
              <MapPin size={14} />
              <span>
                {session
                  ? `Last check-in: ${locationState.toLowerCase()}`
                  : "Location is captured when you check in"}
              </span>
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
