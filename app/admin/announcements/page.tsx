"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Megaphone } from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  StatusPill,
} from "@/components/ui";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { canManageContent, errorMessage } from "@/lib/workspace";
import { Announcement, AnnouncementList } from "@/types/workspace";

const blank = {
  title: "",
  content: "",
  status: "draft" as Announcement["status"],
};
export default function ManageAnnouncementsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<AnnouncementList | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blank);
  useEffect(() => {
    setAllowed(canManageContent(getSession()));
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await api.get<AnnouncementList>(
          `/announcements/manage?page=${page}&size=10`,
        ),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);
  const startEdit = (item?: Announcement) => {
    setForm(
      item
        ? { title: item.title, content: item.content, status: item.status }
        : blank,
    );
    setEditing(item?.id || null);
    setFormError("");
    setSuccess("");
    setShowForm(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setSuccess("");
    try {
      if (editing) await api.patch(`/announcements/${editing}`, form);
      else await api.post("/announcements", form);
      setShowForm(false);
      setSuccess(
        form.status === "published"
          ? "Published. Employees can now see this on their dashboard."
          : form.status === "archived"
            ? "Archived. This announcement is no longer visible to employees."
            : "Draft saved. It is not visible to employees yet.",
      );
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppShell>
      <PageHeader
        eyebrow="Administration"
        title="Announcements"
        description="Share updates with everyone in your organization."
        action={
          allowed && (
            <button
              className="button button-primary"
              onClick={() => startEdit()}
              disabled={saving}
            >
              <Plus size={17} />
              New announcement
            </button>
          )
        }
      />
      {allowed === null ? (
        <p>Loading…</p>
      ) : !allowed ? (
        <ErrorBanner message="Only organization administrators can manage announcements." />
      ) : (
        <>
          {success && (
            <div className="success-banner" role="status">
              {success}
            </div>
          )}
          {showForm && (
            <form className="card content-editor" onSubmit={submit}>
              <div className="card-header">
                <h2>{editing ? "Edit announcement" : "New announcement"}</h2>
                <Megaphone size={21} />
              </div>
              <fieldset disabled={saving} className="content-fields">
                {formError && <ErrorBanner message={formError} />}
                <div className="field">
                  <label htmlFor="announcement-title">Title</label>
                  <input
                    id="announcement-title"
                    required
                    maxLength={160}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="announcement-content">Announcement</label>
                  <textarea
                    id="announcement-content"
                    required
                    maxLength={5000}
                    rows={6}
                    placeholder="What should everyone know?"
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="announcement-status">Visibility</label>
                  <select
                    id="announcement-status"
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as Announcement["status"],
                      })
                    }
                  >
                    <option value="draft">Draft — admin only</option>
                    <option value="published">
                      Published — visible to employees
                    </option>
                    <option value="archived">
                      Archived — hidden from employees
                    </option>
                  </select>
                </div>
                <div className="content-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                  <button className="button button-primary">
                    {saving ? "Saving…" : "Save announcement"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {error && (
            <div className="content-error">
              <ErrorBanner message={error} />
              <button className="button button-secondary" onClick={load}>
                Retry
              </button>
            </div>
          )}
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Announcement table</h2>
                <p>Draft, published, and archived updates</p>
              </div>
              <span className="status-pill">{data?.totalCount ?? 0} total</span>
            </div>
            {loading ? (
              <p className="content-padding" role="status">
                Loading announcements…
              </p>
            ) : !error && !data?.announcements.length ? (
              <EmptyState
                title="Your first update starts here"
                description="Create an announcement, then publish it to employee dashboards."
              />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.announcements.map((item) => (
                      <tr key={item.id}>
                        <td className="announcement-table-title">
                          <strong>{item.title}</strong>
                        </td>
                        <td>
                          <StatusPill value={item.status} />
                        </td>
                        <td>{new Date(item.updatedAt).toLocaleDateString()}</td>
                        <td>
                          <button
                            className="button button-secondary"
                            disabled={saving}
                            onClick={() => startEdit(item)}
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data && data.lastPage > 1 && (
              <div className="content-pagination">
                <button
                  className="button button-secondary"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {data.lastPage}
                </span>
                <button
                  className="button button-secondary"
                  disabled={page >= data.lastPage || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
