"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed } from "lucide-react";
import { api } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import {
  captureAttendanceLocation,
  parseLocationPin,
} from "@/lib/attendanceGeolocation";
import { errorMessage } from "@/lib/workspace";
import { ErrorBanner, StatusPill } from "@/components/ui";

type ReviewRequest = {
  id: string;
  action: "check_in" | "check_out";
  status: string;
  active: boolean;
  latitude: number;
  longitude: number;
  reason: string;
  requestedAt: string;
  employeeName?: string;
  reviewComment?: string;
  reviewedAt?: string;
  updatedAt?: string;
};
type Inbox = { requests: ReviewRequest[]; page: number; lastPage: number };
const maps = (latitude: number, longitude: number) =>
  `https://www.google.com/maps?q=${latitude},${longitude}`;

function ReviewRow({
  request,
  admin,
  onChanged,
}: {
  request: ReviewRequest;
  admin: boolean;
  onChanged: () => void;
}) {
  const [pin, setPin] = useState(`${request.latitude}, ${request.longitude}`),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const canReview =
    request.status === "pending" ||
    (request.status === "processing" &&
      !!request.updatedAt &&
      new Date(request.updatedAt).valueOf() < Date.now() - 300000);
  const review = async (decision: "approve" | "reject") => {
    const point = parseLocationPin(pin);
    if (comment.trim().length < 5) {
      setError("Add a review comment of at least 5 characters.");
      return;
    }
    if (decision === "approve" && !point) {
      setError(
        "Enter valid coordinates or a full Maps link containing coordinates.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.patch(`/attendance/location-requests/${request.id}/review`, {
        decision,
        reviewComment: comment,
        ...point,
      });
      onChanged();
      window.dispatchEvent(new Event("hrm:attendance-change"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="location-request-row">
      <header>
        <div>
          <strong>{request.employeeName || "Your location request"}</strong>
          <small>
            {request.action.replace("_", " ")} · Submitted{" "}
            {new Date(request.requestedAt).toLocaleString([], { hour12: true })}
          </small>
        </div>
        <StatusPill value={request.status} />
      </header>
      <p>{request.reason}</p>
      <a
        className="location-map-link"
        href={maps(request.latitude, request.longitude)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MapPin size={14} /> View proposed pin: {request.latitude},{" "}
        {request.longitude}
      </a>
      {request.reviewComment && (
        <p className="location-review-comment">
          Admin: {request.reviewComment}
        </p>
      )}
      {error && <ErrorBanner message={error} />}
      {admin && canReview && (
        <div className="location-review-fields">
          <label>
            Confirm or correct location
            <input
              aria-label={`Location for ${request.employeeName || request.id}`}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
          <label>
            Review comment
            <textarea
              rows={2}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How you confirmed this location"
            />
          </label>
          <small>
            Approval records the attendance time now, using the confirmed pin.
            It is labeled as admin-entered.
          </small>
          <div className="location-review-actions">
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => void review("approve")}
            >
              Confirm location & record attendance
            </button>
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => void review("reject")}
            >
              Reject
            </button>
          </div>
        </div>
      )}
      {!admin && request.status === "pending" && (
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.patch(
                `/attendance/location-requests/${request.id}/cancel`,
              );
              onChanged();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Cancel request
        </button>
      )}
    </article>
  );
}

export default function AttendanceLocationReview({
  admin = false,
  assistance = false,
  action = "check_in",
  onRecorded,
}: {
  admin?: boolean;
  assistance?: boolean;
  action?: "check_in" | "check_out";
  onRecorded?: () => void;
}) {
  const [page, setPage] = useState(1),
    [pending, setPending] = useState(admin),
    [open, setOpen] = useState(false),
    [pin, setPin] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const {
    data,
    error: loadError,
    refresh,
  } = useLiveData<Inbox>(
    `/attendance/location-requests?page=${page}${admin ? "&scope=organization" : ""}${pending ? "&status=pending" : ""}`,
    15000,
  );
  const previous = useRef<Map<string, string> | null>(null),
    callback = useRef(onRecorded);
  callback.current = onRecorded;
  useEffect(() => {
    if (!data) return;
    if (
      previous.current &&
      data.requests.some(
        (request) =>
          request.status === "approved" &&
          ["pending", "processing"].includes(
            previous.current?.get(request.id) || "",
          ),
      )
    )
      callback.current?.();
    previous.current = new Map(
      data.requests.map((request) => [request.id, request.status]),
    );
  }, [data]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const point = parseLocationPin(pin);
    if (!point) {
      setError(
        "Enter latitude, longitude, or a full Maps link containing coordinates. Short share links must be opened first to copy the coordinates.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.post("/attendance/location-requests", {
        action,
        ...point,
        reason,
      });
      setOpen(false);
      setPin("");
      setReason("");
      setNotice(
        "Location sent to admin. You are not checked in or out until an admin confirms the pin and records attendance.",
      );
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (!admin && !assistance && !data?.requests.length && !loadError)
    return null;
  return (
    <section className="card attendance-location-review" id="location-review">
      <div className="card-header">
        <div>
          <h2>
            {admin ? "Attendance location requests" : "Location assistance"}
          </h2>
          <p>
            {admin
              ? "Review employee pins before recording attendance. Every manual location change is audited."
              : "Location is required. Try on your phone, or send a real location pin to an admin for review."}
          </p>
        </div>
        {admin && (
          <select
            aria-label="Location request filter"
            value={pending ? "pending" : "all"}
            onChange={(e) => {
              setPending(e.target.value === "pending");
              setPage(1);
            }}
          >
            <option value="pending">Pending</option>
            <option value="all">All requests</option>
          </select>
        )}
      </div>
      <div className="location-review-body">
        {(error || loadError) && <ErrorBanner message={error || loadError} />}{" "}
        {notice && <div className="success-banner">{notice}</div>}
        {!admin && assistance && (
          <>
            <div className="location-review-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={() => setOpen((value) => !value)}
              >
                <MapPin size={15} /> Send location to admin
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/attendance`,
                    );
                    setNotice(
                      "Attendance link copied. Open it on your phone, sign in, and use the phone’s location.",
                    );
                  } catch {
                    setError(
                      "Open this website’s /attendance page directly on your phone.",
                    );
                  }
                }}
              >
                Copy phone link
              </button>
            </div>
            {open && (
              <form className="location-review-form" onSubmit={submit}>
                <p>
                  Open Maps on your phone, select your actual location, and copy
                  its coordinates. Sending a pin alone does not record
                  attendance.
                </p>
                <a
                  className="location-map-link"
                  href="https://www.google.com/maps"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Maps
                </a>
                <label>
                  Location coordinates or full Maps link
                  <input
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="33.6463, 72.9965"
                  />
                </label>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const point = await captureAttendanceLocation();
                      setPin(`${point.latitude}, ${point.longitude}`);
                    } catch (e) {
                      setError(errorMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <LocateFixed size={14} /> Retry this device’s location
                </button>
                <label>
                  Reason
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why automatic location is failing and where you are working"
                  />
                </label>
                <button className="button button-primary" disabled={busy}>
                  {busy
                    ? "Working…"
                    : `Send ${action.replace("_", " ")} location for review`}
                </button>
              </form>
            )}
          </>
        )}
        <div className="location-review-list">
          {data?.requests.map((request) => (
            <ReviewRow
              key={request.id}
              request={request}
              admin={admin}
              onChanged={() => {
                refresh();
                if (admin) callback.current?.();
              }}
            />
          ))}
        </div>
        {admin && data && !data.requests.length && (
          <p className="panel-message">No location requests to review.</p>
        )}
        {data && data.lastPage > 1 && (
          <div className="location-review-actions">
            <button
              className="button button-secondary"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {data.lastPage}
            </span>
            <button
              className="button button-secondary"
              disabled={page >= data.lastPage}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
