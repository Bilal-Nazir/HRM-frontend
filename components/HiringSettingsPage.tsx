"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Trash2,
  Users,
  Eye,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import RichTextEditor from "@/components/RichTextEditor";
import HiringPagePreview from "@/components/HiringPagePreview";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  StatusPill,
} from "@/components/ui";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  HiringPage,
  HiringApplication,
  applicationStatuses,
  newHiringPage,
} from "@/lib/hiring";

const date = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
const failure = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

function ApplicantReview({
  id,
  onBack,
  onSaved,
}: {
  id: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [application, setApplication] = useState<HiringApplication | null>(
      null,
    ),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [cvBusy, setCvBusy] = useState(false),
    [cvUrl, setCvUrl] = useState("");
  useEffect(() => {
    let active = true;
    api
      .get<{ application: HiringApplication }>(`/hiring/applications/${id}`)
      .then(({ application }) => {
        if (active) setApplication(application);
      })
      .catch((error) => {
        if (active) setError(failure(error));
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(
    () => () => {
      if (cvUrl) URL.revokeObjectURL(cvUrl);
    },
    [cvUrl],
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!application) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.patch<{ application: HiringApplication }>(
        `/hiring/applications/${id}`,
        { status: application.status, notes: application.notes },
      );
      setApplication(result.application);
      setMessage("Review saved.");
      onSaved();
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  }
  async function cv(preview: boolean) {
    if (!application) return;
    setCvBusy(true);
    setError("");
    try {
      const blob = await api.download(
          `/hiring/applications/${id}/cv${preview ? "" : "?download=1"}`,
        ),
        url = URL.createObjectURL(blob);
      if (preview) setCvUrl(url);
      else {
        const link = document.createElement("a");
        link.href = url;
        link.download = application.cvName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      setError(failure(error));
    } finally {
      setCvBusy(false);
    }
  }
  return (
    <section className="hiring-panel hiring-review">
      <button type="button" className="hiring-back" onClick={onBack}>
        <ArrowLeft size={17} />
        All applicants
      </button>
      {error && <ErrorBanner message={error} />}
      {message && (
        <p className="hiring-success" role="status">
          {message}
        </p>
      )}
      {!application ? (
        !error && <p role="status">Loading application…</p>
      ) : (
        <>
          <header className="hiring-review-header">
            <div>
              <h2>{application.name}</h2>
              <p>
                {application.pageTitle} · Applied {date(application.createdAt)}
              </p>
            </div>
            <StatusPill value={application.status} />
          </header>
          <div className="hiring-contact">
            <a href={`mailto:${application.email}`}>{application.email}</a>
            {application.phone && <span>{application.phone}</span>}
          </div>
          <div className="hiring-cv-row">
            <FileText size={23} />
            <div>
              <strong>{application.cvName}</strong>
              <small>{Math.ceil(application.cvSize / 1024)} KB</small>
            </div>
            {application.cvType === "application/pdf" && (
              <button
                className="button button-secondary"
                disabled={cvBusy}
                type="button"
                onClick={() => void cv(true)}
              >
                Preview CV
              </button>
            )}
            <button
              className="button button-secondary"
              disabled={cvBusy}
              type="button"
              onClick={() => void cv(false)}
            >
              {cvBusy ? "Opening…" : "Download CV"}
            </button>
          </div>
          {cvUrl && (
            <div className="hiring-cv-preview">
              <button
                type="button"
                className="hiring-back"
                onClick={() => setCvUrl("")}
              >
                Close preview
              </button>
              <iframe
                title={`${application.name} CV`}
                src={cvUrl}
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          {application.coverLetter && (
            <section>
              <h3>Cover letter</h3>
              <p className="hiring-prewrap">{application.coverLetter}</p>
            </section>
          )}
          {application.answers
            ?.filter((a) => a.value)
            .map((a) => (
              <section key={a.questionId}>
                <h3>{a.label}</h3>
                <p className="hiring-prewrap">{a.value}</p>
              </section>
            ))}
          <form onSubmit={save} className="hiring-review-form">
            <h3>Internal review</h3>
            <p>
              Notes and status are only visible to admins. Saving does not send
              an email to the applicant.
            </p>
            <label className="field">
              Application status
              <select
                value={application.status}
                onChange={(event) =>
                  setApplication({ ...application, status: event.target.value })
                }
              >
                {applicationStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Private notes
              <textarea
                rows={5}
                maxLength={10000}
                value={application.notes || ""}
                onChange={(event) =>
                  setApplication({ ...application, notes: event.target.value })
                }
              />
            </label>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Saving…" : "Save review"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

export default function HiringSettingsPage() {
  const user = getSession();
  const pathname = usePathname();
  const allowed = !!(user?.isCompanyOwner || user?.isPlatformAdmin);
  const [pages, setPages] = useState<HiringPage[]>([]),
    [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [tab, setTab] = useState<"applicants" | "page">("applicants"),
    [draft, setDraft] = useState<HiringPage | null>(null),
    [preview, setPreview] = useState(false),
    [saving, setSaving] = useState(false);
  const [applicants, setApplicants] = useState<HiringApplication[]>([]),
    [total, setTotal] = useState(0),
    [pageNumber, setPageNumber] = useState(1),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [appLoading, setAppLoading] = useState(false),
    [appError, setAppError] = useState(""),
    [revision, setRevision] = useState(0),
    [applicationId, setApplicationId] = useState("");
  const [publicOrigin, setPublicOrigin] = useState("");
  const selectedPage = pages.find((p) => p.id === selected);
  const reloadPages = useCallback(async () => {
    const data = await api.get<{ pages: HiringPage[] }>("/hiring/pages");
    setPages(data.pages);
    return data.pages;
  }, []);
  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    let active = true;
    setPublicOrigin(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    reloadPages()
      .then((items) => {
        if (!active) return;
        const match = items.find((p) => p.id === params.get("page"));
        setSelected(match?.id || items[0]?.id || "");
        if (match && params.get("application"))
          setApplicationId(params.get("application")!);
      })
      .catch((error) => {
        if (active) setError(failure(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, reloadPages]);
  useEffect(() => {
    if (!allowed || !selected || tab !== "applicants") return;
    let active = true;
    setAppLoading(true);
    setAppError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        pageId: selected,
        page: String(pageNumber),
        ...(status && { status }),
        ...(search.trim() && { search: search.trim() }),
      });
      api
        .get<{ applications: HiringApplication[]; total: number }>(
          `/hiring/applications?${params}`,
        )
        .then((data) => {
          if (active) {
            setApplicants(data.applications);
            setTotal(data.total);
          }
        })
        .catch((error) => {
          if (active) {
            setAppError(failure(error));
            setApplicants([]);
          }
        })
        .finally(() => {
          if (active) setAppLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [allowed, selected, tab, pageNumber, status, search, revision]);

  function selectPage(item: HiringPage) {
    if (draft && !window.confirm("Discard unsaved page changes?")) return;
    setSelected(item.id);
    setDraft(null);
    setApplicationId("");
    setTab("applicants");
    setPreview(false);
    setPageNumber(1);
    setMessage("");
    setError("");
    window.history.replaceState(
      null,
      "",
      `${pathname}?page=${item.id}`,
    );
  }
  function newPage() {
    if (draft && !window.confirm("Discard unsaved page changes?")) return;
    setDraft(newHiringPage());
    setTab("page");
    setPreview(false);
    setApplicationId("");
    setMessage("");
    setError("");
  }
  async function savePage(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = draft.id
        ? await api.patch<{ page: HiringPage }>(
            `/hiring/pages/${draft.id}`,
            draft,
          )
        : await api.post<{ page: HiringPage }>("/hiring/pages", draft);
      await reloadPages();
      setSelected(data.page.id);
      setDraft(null);
      setTab("page");
      setPreview(false);
      setMessage(
        data.page.status === "published"
          ? "Page published. Your application link is ready to share."
          : "Page saved.",
      );
      window.history.replaceState(
        null,
        "",
        `${pathname}?page=${data.page.id}`,
      );
    } catch (error) {
      setError(failure(error));
    } finally {
      setSaving(false);
    }
  }
  function patchDraft<K extends keyof HiringPage>(
    key: K,
    value: HiringPage[K],
  ) {
    setDraft((current) => current && { ...current, [key]: value });
  }
  function showApplicants() {
    if (draft && !window.confirm("Discard unsaved page changes?")) return;
    setDraft(null);
    setTab("applicants");
    setPreview(false);
  }
  const shareLink = selectedPage
    ? `${publicOrigin}/careers/${selectedPage.publicId}`
    : "";
  return (
    <AppShell>
      <PageHeader
        eyebrow="Settings"
        title="Hiring"
        description="Create an application page when you’re hiring, and review candidates here."
        action={
          allowed && (
            <button className="button button-secondary" onClick={newPage}>
              <Plus size={17} />
              Create hiring page
            </button>
          )
        }
      />
      {!allowed ? (
        <EmptyState
          title="Admin access required"
          description="Hiring pages and applicants are managed by your company admin."
        />
      ) : (
        <>
          {error && <ErrorBanner message={error} />}
          {message && (
            <p className="hiring-success" role="status">
              {message}
            </p>
          )}
          {loading ? (
            <p role="status">Loading hiring pages…</p>
          ) : (
            <div className="hiring-management">
              <aside className="hiring-pages">
                <h2>
                  Hiring pages <small>{pages.length}</small>
                </h2>
                {pages.length ? (
                  pages.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`hiring-page-item${selected === item.id ? " active" : ""}`}
                      onClick={() => selectPage(item)}
                    >
                      <strong>{item.title}</strong>
                      <span>
                        <StatusPill value={item.status} />
                        <small>
                          {item.applicants || 0} applicants
                          {item.newApplicants
                            ? ` · ${item.newApplicants} new`
                            : ""}
                        </small>
                      </span>
                    </button>
                  ))
                ) : (
                  <p>
                    Your hiring pages will appear here. Create one when you have
                    an opening.
                  </p>
                )}
              </aside>
              <div className="hiring-workspace">
                {applicationId ? (
                  <ApplicantReview
                    key={applicationId}
                    id={applicationId}
                    onBack={() => {
                      setApplicationId("");
                      window.history.replaceState(
                        null,
                        "",
                        `${pathname}?page=${selected}`,
                      );
                    }}
                    onSaved={() => {
                      setRevision((n) => n + 1);
                      void reloadPages().catch(() => {});
                    }}
                  />
                ) : !selectedPage && !draft ? (
                  <section className="hiring-panel">
                    <EmptyState
                      title="A simple home for your next hire"
                      description="Design a page, share its application link, and collect CVs in one place."
                    />
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={newPage}
                    >
                      <Plus size={17} />
                      Create your first page
                    </button>
                  </section>
                ) : (
                  <>
                    <div
                      className="hiring-tabs"
                      role="tablist"
                      aria-label="Hiring page sections"
                    >
                      <button
                        role="tab"
                        aria-selected={tab === "applicants"}
                        onClick={showApplicants}
                        disabled={!selectedPage}
                      >
                        <Users size={17} />
                        Applicants
                      </button>
                      <button
                        role="tab"
                        aria-selected={tab === "page"}
                        onClick={() => setTab("page")}
                      >
                        <FileText size={17} />
                        Page & sharing
                      </button>
                    </div>
                    {tab === "applicants" && selectedPage ? (
                      <section className="hiring-panel">
                        <div className="hiring-applicant-toolbar">
                          <h2>
                            Applicants <small>{total}</small>
                          </h2>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => setRevision((n) => n + 1)}
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="hiring-filters">
                          <label className="hiring-search">
                            <Search size={17} />
                            <input
                              aria-label="Search applicants"
                              placeholder="Search name or email"
                              maxLength={120}
                              value={search}
                              onChange={(event) => {
                                setSearch(event.target.value);
                                setPageNumber(1);
                              }}
                            />
                          </label>
                          <select
                            aria-label="Filter application status"
                            value={status}
                            onChange={(event) => {
                              setStatus(event.target.value);
                              setPageNumber(1);
                            }}
                          >
                            <option value="">All statuses</option>
                            {applicationStatuses.map((s) => (
                              <option key={s} value={s}>
                                {s[0].toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        {appError ? (
                          <ErrorBanner message={appError} />
                        ) : appLoading ? (
                          <p role="status">Loading applicants…</p>
                        ) : !applicants.length ? (
                          <EmptyState
                            title="No applications yet"
                            description={
                              search || status
                                ? "Try changing your search or status filter."
                                : "Applications and CVs will appear here after candidates apply through your published page."
                            }
                          />
                        ) : (
                          <div className="hiring-applicant-list">
                            {applicants.map((a) => (
                              <button
                                type="button"
                                key={a.id}
                                onClick={() => {
                                  setApplicationId(a.id);
                                  window.history.replaceState(
                                    null,
                                    "",
                                    `${pathname}?page=${selected}&application=${a.id}`,
                                  );
                                }}
                              >
                                <div>
                                  <strong>{a.name}</strong>
                                  <span>{a.email}</span>
                                  <small>{date(a.createdAt)}</small>
                                </div>
                                <StatusPill value={a.status} />
                              </button>
                            ))}
                          </div>
                        )}
                        {total > 25 && (
                          <div className="hiring-pagination">
                            <button
                              type="button"
                              disabled={pageNumber === 1 || appLoading}
                              onClick={() => setPageNumber((n) => n - 1)}
                            >
                              Previous
                            </button>
                            <span>
                              Page {pageNumber} of {Math.ceil(total / 25)}
                            </span>
                            <button
                              type="button"
                              disabled={pageNumber * 25 >= total || appLoading}
                              onClick={() => setPageNumber((n) => n + 1)}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </section>
                    ) : draft ? (
                      <section className="hiring-panel">
                        <div className="hiring-applicant-toolbar">
                          <h2>
                            {draft.id ? "Edit hiring page" : "New hiring page"}
                          </h2>
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => setPreview(!preview)}
                          >
                            <Eye size={16} />
                            {preview ? "Back to editor" : "Preview"}
                          </button>
                        </div>
                        {preview ? (
                          <>
                            <HiringPagePreview
                              page={draft}
                              companyName={user?.companyName || "Your company"}
                            />
                            <p className="hiring-muted">
                              Preview only. Publish the page to let candidates
                              apply.
                            </p>
                          </>
                        ) : (
                          <form
                            onSubmit={savePage}
                            className="hiring-page-form"
                          >
                            <label className="field">
                              Job title
                              <input
                                value={draft.title}
                                onChange={(event) =>
                                  patchDraft("title", event.target.value)
                                }
                                maxLength={160}
                                required
                                placeholder="e.g. Frontend Developer"
                              />
                            </label>
                            <label className="field">
                              Short introduction
                              <textarea
                                rows={2}
                                value={draft.introduction}
                                onChange={(event) =>
                                  patchDraft("introduction", event.target.value)
                                }
                                maxLength={500}
                                placeholder="A short welcome for your candidates"
                              />
                            </label>
                            <RichTextEditor
                              value={draft.description}
                              onChange={(value) =>
                                patchDraft("description", value)
                              }
                              label="Job description"
                            />
                            <div className="hiring-form-grid">
                              <label className="field">
                                Location
                                <input
                                  maxLength={160}
                                  value={draft.location}
                                  onChange={(event) =>
                                    patchDraft("location", event.target.value)
                                  }
                                  placeholder="e.g. Islamabad"
                                />
                              </label>
                              <label className="field">
                                Workplace
                                <select
                                  value={draft.workMode}
                                  onChange={(event) =>
                                    patchDraft("workMode", event.target.value)
                                  }
                                >
                                  {["On-site", "Hybrid", "Remote"].map((s) => (
                                    <option key={s}>{s}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                Employment type
                                <select
                                  value={draft.employmentType}
                                  onChange={(event) =>
                                    patchDraft(
                                      "employmentType",
                                      event.target.value,
                                    )
                                  }
                                >
                                  {[
                                    "Full-time",
                                    "Part-time",
                                    "Contract",
                                    "Internship",
                                  ].map((s) => (
                                    <option key={s}>{s}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                Page accent
                                <input
                                  type="color"
                                  value={draft.accentColor}
                                  onChange={(event) =>
                                    patchDraft(
                                      "accentColor",
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                            </div>
                            <section className="hiring-questions">
                              <h3>
                                Additional questions <small>(optional)</small>
                              </h3>
                              <p>
                                Candidates already provide their name, email,
                                phone, cover letter and CV.
                              </p>
                              {draft.questions.map((q, index) => (
                                <div className="hiring-question" key={q.id}>
                                  <label className="field">
                                    Question {index + 1}
                                    <input
                                      value={q.label}
                                      maxLength={300}
                                      required
                                      onChange={(event) =>
                                        patchDraft(
                                          "questions",
                                          draft.questions.map((item, i) =>
                                            i === index
                                              ? {
                                                  ...item,
                                                  label: event.target.value,
                                                }
                                              : item,
                                          ),
                                        )
                                      }
                                    />
                                  </label>
                                  <label className="hiring-consent">
                                    <input
                                      type="checkbox"
                                      checked={q.required}
                                      onChange={(event) =>
                                        patchDraft(
                                          "questions",
                                          draft.questions.map((item, i) =>
                                            i === index
                                              ? {
                                                  ...item,
                                                  required:
                                                    event.target.checked,
                                                }
                                              : item,
                                          ),
                                        )
                                      }
                                    />
                                    Required
                                  </label>
                                  <button
                                    aria-label={`Remove question ${index + 1}`}
                                    type="button"
                                    onClick={() =>
                                      patchDraft(
                                        "questions",
                                        draft.questions.filter(
                                          (_, i) => i !== index,
                                        ),
                                      )
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                              {draft.questions.length < 6 && (
                                <button
                                  type="button"
                                  className="button button-secondary"
                                  onClick={() =>
                                    patchDraft("questions", [
                                      ...draft.questions,
                                      {
                                        id: crypto.randomUUID(),
                                        label: "",
                                        required: false,
                                      },
                                    ])
                                  }
                                >
                                  <Plus size={16} />
                                  Add question
                                </button>
                              )}
                            </section>
                            <label className="field">
                              Page status
                              <select
                                value={draft.status}
                                onChange={(event) =>
                                  patchDraft(
                                    "status",
                                    event.target.value as HiringPage["status"],
                                  )
                                }
                              >
                                <option value="draft">Draft — private</option>
                                <option value="published">
                                  Published — accepting applications
                                </option>
                                <option value="closed">
                                  Closed — stop applications
                                </option>
                                <option value="archived">
                                  Archived — hide public page
                                </option>
                              </select>
                            </label>
                            <div className="hiring-actions">
                              <button
                                type="button"
                                className="button button-secondary"
                                disabled={saving}
                                onClick={() => {
                                  setDraft(null);
                                  setPreview(false);
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                className="button button-primary"
                                disabled={saving}
                              >
                                {saving
                                  ? "Saving…"
                                  : draft.status === "published"
                                    ? "Save & publish"
                                    : "Save page"}
                              </button>
                            </div>
                          </form>
                        )}
                      </section>
                    ) : (
                      selectedPage && (
                        <section className="hiring-panel">
                          <div className="hiring-applicant-toolbar">
                            <div>
                              <h2>{selectedPage.title}</h2>
                              <StatusPill value={selectedPage.status} />
                            </div>
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => {
                                setDraft({
                                  ...selectedPage,
                                  questions: selectedPage.questions.map(
                                    (q) => ({ ...q }),
                                  ),
                                });
                                setPreview(false);
                              }}
                            >
                              Edit page
                            </button>
                          </div>
                          {["published", "closed"].includes(
                            selectedPage.status,
                          ) ? (
                            <div className="hiring-sharing">
                              <label className="field">
                                Application link
                                <input
                                  aria-label="Application link"
                                  readOnly
                                  value={shareLink}
                                  onFocus={(event) => event.target.select()}
                                />
                              </label>
                              <div className="hiring-actions">
                                <button
                                  type="button"
                                  className="button button-secondary"
                                  onClick={() =>
                                    navigator.clipboard
                                      .writeText(shareLink)
                                      .then(() =>
                                        setMessage("Application link copied."),
                                      )
                                      .catch(() =>
                                        setMessage(
                                          "Select and copy the application link above.",
                                        ),
                                      )
                                  }
                                >
                                  <Copy size={16} />
                                  Copy link
                                </button>
                                <a
                                  className="button button-secondary"
                                  href={`/careers/${selectedPage.publicId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink size={16} />
                                  Open page
                                </a>
                              </div>
                              {selectedPage.status === "closed" && (
                                <p>
                                  Applicants can read this page, but new
                                  submissions are closed.
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="hiring-muted">
                              {selectedPage.status === "draft"
                                ? "This page is private. Edit and publish it when you’re ready to share."
                                : "This page is archived and its public link is unavailable. Existing applications are retained."}
                            </p>
                          )}
                          <HiringPagePreview
                            page={selectedPage}
                            companyName={user?.companyName || "Your company"}
                          />
                        </section>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
