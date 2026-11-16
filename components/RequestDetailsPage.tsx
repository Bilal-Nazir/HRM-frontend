"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  MessageSquare,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { ErrorBanner, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { errorMessage } from "@/lib/workspace";
import { LeaveRequest } from "@/types";

type Comment = {
  id: string;
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
};
type History = {
  id: string;
  action: string;
  authorName: string;
  body?: string;
  createdAt: string;
};
type Details = {
  request: LeaveRequest & {
    createdAt: string;
    reviewedAt?: string;
    reviewComment?: string;
    reviewedBy?: { name: string };
    employee: { name: string; employeeCode?: string; jobTitle?: string };
  };
  comments: Comment[];
  history: History[];
  reviewers: {
    id: string;
    name: string;
    employeeCode?: string;
    jobTitle?: string;
  }[];
  permissions: {
    canComment: boolean;
    canReview: boolean;
    canCancel: boolean;
    role: string;
  };
};
const timestamp = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        hour12: true,
      }).format(new Date(value))
    : "—";
const date = (value: string) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function RequestDetailsPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const prefix = usePathname().startsWith("/admin") ? "/admin" : "";
  const { data, error, refresh } = useLiveData<Details>(
    `/leave/requests/${encodeURIComponent(requestId)}`,
    10000,
  );
  const [tab, setTab] = useState("all"),
    [body, setBody] = useState(""),
    [decisionNote, setDecisionNote] = useState("");
  const [saving, setSaving] = useState(false),
    [actionError, setActionError] = useState(""),
    [success, setSuccess] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    setBody("");
    setDecisionNote("");
    setActionError("");
    setSuccess("");
  }, [requestId]);
  async function act(action: "comment" | "approved" | "rejected" | "cancel") {
    if (busy.current) return;
    if (
      action !== "comment" &&
      !window.confirm(
        action === "cancel"
          ? "Cancel this request?"
          : `${action === "approved" ? "Approve" : "Reject"} this request?`,
      )
    )
      return;
    busy.current = true;
    setSaving(true);
    setActionError("");
    setSuccess("");
    try {
      if (action === "comment") {
        await api.post(`/leave/requests/${requestId}/comments`, { body });
        setBody("");
        setSuccess("Comment added.");
      } else if (action === "cancel") {
        await api.patch(`/leave/requests/${requestId}/cancel`);
        setSuccess("Request cancelled.");
      } else {
        await api.patch(`/leave/requests/${requestId}/review`, {
          status: action,
          comment: decisionNote.trim(),
        });
        setDecisionNote("");
        setSuccess(`Request ${action}.`);
      }
      refresh();
      window.dispatchEvent(new Event("focus"));
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const entries = data
    ? [
        ...(tab !== "history"
          ? data.comments.map((comment) => ({
              ...comment,
              kind: "comment",
              action: "commented",
            }))
          : []),
        ...(tab !== "comments"
          ? data.history.map((item) => ({
              ...item,
              authorRole: "",
              kind: "history",
            }))
          : []),
      ].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    : [];
  return (
    <AppShell>
      <Link className="request-back" href={`${prefix}/leave`}>
        <ArrowLeft size={17} />
        Requests
      </Link>
      {error && <ErrorBanner message={error} />}
      {actionError && <ErrorBanner message={actionError} />}
      {success && (
        <div className="success-banner" role="status">
          {success}
        </div>
      )}
      {!data && !error && <div className="loading-line" />}
      {data && !error && (
        <>
          <header className="request-detail-heading">
            <div>
              <span className="eyebrow">Employee request</span>
              <h1>{data.request.leaveTypeName || "Leave"} request</h1>
              <p>
                {data.request.employee.name} · Submitted{" "}
                {timestamp(data.request.createdAt)}
              </p>
            </div>
            <StatusPill value={data.request.status} />
          </header>
          <div className="request-detail-grid">
            <div className="request-main">
              <section className="card">
                <div className="card-header">
                  <h2>Request details</h2>
                </div>
                <div className="request-detail-body">
                  <div className="request-facts">
                    <div>
                      <CalendarDays size={19} />
                      <span>
                        From<strong>{date(data.request.startDate)}</strong>
                      </span>
                    </div>
                    <div>
                      <CalendarDays size={19} />
                      <span>
                        To<strong>{date(data.request.endDate)}</strong>
                      </span>
                    </div>
                    <div>
                      <Clock3 size={19} />
                      <span>
                        Duration
                        <strong>
                          {data.request.totalDays} day
                          {data.request.totalDays === 1 ? "" : "s"}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <h3>Reason</h3>
                  <p className="request-reason">
                    {data.request.reason || "No reason supplied."}
                  </p>
                  {data.request.reviewedAt && (
                    <div className="request-decision">
                      <ShieldCheck size={19} />
                      <div>
                        <strong>
                          {data.request.reviewedBy?.name || "Administrator"}{" "}
                          {data.request.status} this request
                        </strong>
                        <small>{timestamp(data.request.reviewedAt)}</small>
                        {data.request.reviewComment && (
                          <p>{data.request.reviewComment}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Discussion & history</h2>
                    <p>
                      Comments and decisions remain attached to this request.
                    </p>
                  </div>
                  <MessageSquare size={20} />
                </div>
                <div
                  className="request-activity-tabs"
                  role="tablist"
                  aria-label="Request activity"
                >
                  {["all", "comments", "history"].map((value) => (
                    <button
                      key={value}
                      role="tab"
                      aria-selected={tab === value}
                      id={`request-tab-${value}`}
                      type="button"
                      onClick={() => setTab(value)}
                      className={tab === value ? "active" : ""}
                    >
                      {value === "all"
                        ? "All activity"
                        : value === "comments"
                          ? `Comments (${data.comments.length})`
                          : "History"}
                    </button>
                  ))}
                </div>
                <div
                  className="request-timeline"
                  role="tabpanel"
                  aria-labelledby={`request-tab-${tab}`}
                >
                  {!entries.length && (
                    <p className="request-empty">
                      No{" "}
                      {tab === "comments"
                        ? "comments yet. Start the discussion below."
                        : "activity yet."}
                    </p>
                  )}
                  {entries.map((item) => (
                    <article
                      key={`${item.kind}-${item.id}`}
                      className={`request-event ${item.kind}`}
                    >
                      <div className="avatar">{initials(item.authorName)}</div>
                      <div className="request-event-copy">
                        <div>
                          <strong>{item.authorName}</strong>
                          {item.authorRole && (
                            <span className="request-role">
                              {item.authorRole}
                            </span>
                          )}
                          {item.kind === "history" && (
                            <span>
                              {item.action === "submitted"
                                ? "submitted this request"
                                : `${item.action} this request`}
                            </span>
                          )}
                        </div>
                        <time dateTime={item.createdAt}>
                          {timestamp(item.createdAt)}
                        </time>
                        {item.body && <p>{item.body}</p>}
                      </div>
                    </article>
                  ))}
                </div>
                {data.permissions.canComment && (
                  <form
                    className="request-comment-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void act("comment");
                    }}
                  >
                    <label htmlFor="request-comment">Add a comment</label>
                    <textarea
                      id="request-comment"
                      disabled={saving}
                      rows={4}
                      value={body}
                      maxLength={4000}
                      onChange={(event) => setBody(event.target.value)}
                      placeholder="Add context, ask a question, or leave a remark…"
                      required
                    />
                    <div>
                      <small>{body.length}/4000</small>
                      <button
                        className="button button-primary"
                        disabled={saving || !body.trim()}
                      >
                        <Send size={16} />
                        {saving ? "Saving…" : "Add comment"}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </div>
            <aside className="request-sidebar">
              <section className="card">
                <div className="card-header">
                  <h2>Employee</h2>
                </div>
                <div className="request-detail-body">
                  <div className="person-cell">
                    <div className="avatar">
                      {initials(data.request.employee.name)}
                    </div>
                    <div>
                      <strong>{data.request.employee.name}</strong>
                      <span>{data.request.employee.employeeCode}</span>
                    </div>
                  </div>
                  {data.request.employee.jobTitle && (
                    <p className="muted">{data.request.employee.jobTitle}</p>
                  )}
                </div>
              </section>
              <section className="card">
                <div className="card-header">
                  <h2>Review workflow</h2>
                  <Users size={19} />
                </div>
                <div className="request-detail-body">
                  <h3>Manager / team lead</h3>
                  {data.reviewers.length ? (
                    data.reviewers.map((person) => (
                      <div className="request-reviewer" key={person.id}>
                        <div className="avatar">{initials(person.name)}</div>
                        <span>
                          <strong>{person.name}</strong>
                          <small>
                            {person.jobTitle || person.employeeCode}
                          </small>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No manager or team lead assigned.</p>
                  )}
                  <p className="request-workflow-note">
                    Managers and leads can discuss this request. Final approval
                    or rejection is made by a company admin or Super Admin.
                  </p>
                </div>
              </section>
              {data.permissions.canReview && (
                <section className="card">
                  <div className="card-header">
                    <h2>Admin decision</h2>
                    <ShieldCheck size={19} />
                  </div>
                  <div className="request-detail-body">
                    <label htmlFor="request-decision-note">
                      Decision note <span className="muted">(optional)</span>
                    </label>
                    <textarea
                      id="request-decision-note"
                      disabled={saving}
                      rows={4}
                      maxLength={4000}
                      value={decisionNote}
                      onChange={(event) => setDecisionNote(event.target.value)}
                      placeholder="Explain your decision…"
                    />
                    <div className="request-decision-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={saving}
                        onClick={() => void act("approved")}
                      >
                        <Check size={16} />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={saving}
                        onClick={() => void act("rejected")}
                      >
                        <X size={16} />
                        Reject
                      </button>
                    </div>
                  </div>
                </section>
              )}
              {data.permissions.canCancel && (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={saving}
                  onClick={() => void act("cancel")}
                >
                  Cancel my request
                </button>
              )}
            </aside>
          </div>
        </>
      )}
    </AppShell>
  );
}
