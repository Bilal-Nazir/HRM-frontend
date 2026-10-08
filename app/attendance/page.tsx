"use client";

import AppShell from "@/components/AppShell";
import CheckoutConfirmation from "@/components/CheckoutConfirmation";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  StatusPill,
} from "@/components/ui";
import { api } from "@/lib/api";
import { captureAttendanceLocation, errorMessage } from "@/lib/workspace";
import { useClientClock } from "@/lib/useClientClock";
import { Attendance } from "@/types";
import { Clock3, LocateFixed, LogIn, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function sessionDuration(record: Attendance) {
  if (!record.checkOutAt) return "In progress";
  const minutes = Math.max(
    0,
    Math.floor(
      (new Date(record.checkOutAt).getTime() -
        new Date(record.checkInAt).getTime()) /
        60000,
    ),
  );
  return Number.isFinite(minutes)
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : "—";
}

export default function AttendancePage() {
  const [records, setRecords] = useState<Attendance[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"idle" | "locating" | "saving">("idle");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const actionInProgress = useRef(false);
  const now = useClientClock();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await api.get<{ attendances: Attendance[] }>(
        "/attendance/history?size=50",
      );
      setRecords(result.attendances || []);
    } catch (error) {
      setRecords(null);
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  const openRecord = records?.find(
    (record) =>
      !record.checkOutAt && ["open", "flagged"].includes(record.status),
  );

  const attendanceAction = async (confirmed = false) => {
    if (actionInProgress.current || loading || records === null) return;
    if (openRecord && !confirmed) {
      setConfirmCheckout(true);
      return;
    }
    if (confirmed && !openRecord) {
      setConfirmCheckout(false);
      return;
    }
    setConfirmCheckout(false);
    actionInProgress.current = true;
    setAction("locating");
    setActionError("");
    setSuccess("");
    let submitted = false;
    try {
      const location = await captureAttendanceLocation();
      setAction("saving");
      submitted = true;
      await api.post(
        openRecord ? "/attendance/check-out" : "/attendance/check-in",
        location,
      );
      setSuccess(
        openRecord
          ? "Checked out successfully. Your location was recorded."
          : "Checked in successfully. Your location was recorded.",
      );
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      // Reconcile after success, conflict, or an uncertain network result before enabling another action.
      if (submitted) await load();
      setAction("idle");
      actionInProgress.current = false;
    }
  };

  return (
    <AppShell>
      {confirmCheckout && (
        <CheckoutConfirmation
          onCancel={() => setConfirmCheckout(false)}
          onConfirm={() => void attendanceAction(true)}
        />
      )}
      <div className="attendance-page">
        <PageHeader
          eyebrow="Time and presence"
          title="Attendance"
          description="Your workday, clearly recorded."
        />
        {loadError && (
          <div className="content-error" role="alert">
            <ErrorBanner message={`Unable to load attendance: ${loadError}`} />
            <button
              className="button button-secondary"
              onClick={load}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        )}
        {actionError && (
          <div role="alert">
            <ErrorBanner message={actionError} />
          </div>
        )}
        {success && (
          <div className="success-banner" role="status">
            {success}
          </div>
        )}

        <section className="attendance-hero">
          <div className="attendance-intro">
            <span className="attendance-symbol">
              <Clock3 size={24} />
            </span>
            <span className="eyebrow">
              {loading
                ? "Your workday"
                : records === null
                  ? "Status unavailable"
                  : openRecord
                    ? "Active session"
                    : "Ready when you are"}
            </span>
            <h2>
              {loading
                ? "Loading your attendance…"
                : records === null
                  ? "Let’s reconnect."
                  : openRecord
                    ? "You're checked in."
                    : "Start your workday."}
            </h2>
            <p>
              {records === null && !loading
                ? "Reload your attendance before checking in or out."
                : openRecord
                  ? `Started at ${new Date(openRecord.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Check out when you're done.`
                  : "Check in to start your session. We’ll take care of the time."}
            </p>
            <div className="location-note">
              <LocateFixed size={16} />
              <span>Location is captured only when you check in or out.</span>
            </div>
          </div>
          <div className="attendance-action">
            <span className="attendance-clock-label">Your local time</span>
            <strong>
              {now
                ? now.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </strong>
            <span>
              {now
                ? now.toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Loading local time…"}
            </span>
            <button
              type="button"
              className="button button-primary attendance-submit"
              onClick={() => void attendanceAction()}
              disabled={action !== "idle" || loading || records === null}
            >
              {openRecord ? <LogOut size={18} /> : <LogIn size={18} />}
              {action === "locating"
                ? "Getting location…"
                : action === "saving"
                  ? "Saving…"
                  : loading
                    ? "Loading…"
                    : openRecord
                      ? "Check out"
                      : "Check in"}
            </button>
          </div>
        </section>

        <section className="card attendance-history" aria-busy={loading}>
          <div className="card-header">
            <div>
              <span className="section-kicker">Your activity</span>
              <h2>Attendance history</h2>
              <p>Your recent check-ins and check-outs</p>
            </div>
            <Clock3 size={20} />
          </div>
          {loading ? (
            <p className="content-padding content-note" role="status">
              Loading attendance…
            </p>
          ) : records === null ? (
            <EmptyState
              title="Attendance unavailable"
              description="Use Retry above to load your sessions again."
            />
          ) : records.length === 0 ? (
            <EmptyState
              title="A fresh start"
              description="Your first check-in will appear here."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check in</th>
                    <th>Check out</th>
                    <th>Duration</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.workDate}</td>
                      <td>
                        {new Date(record.checkInAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        {record.checkOutAt
                          ? new Date(record.checkOutAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td>{sessionDuration(record)}</td>
                      <td>
                        {record.checkInWithinGeofence === true
                          ? "Within office area"
                          : record.checkInWithinGeofence === false
                            ? "Outside office area"
                            : "Not verified"}
                      </td>
                      <td>
                        <StatusPill value={record.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
