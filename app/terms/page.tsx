"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileText, Pencil } from "lucide-react";
import AppShell from "@/components/AppShell";
import { EmptyState, ErrorBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { canManageContent, errorMessage } from "@/lib/workspace";
import { Terms } from "@/types/workspace";

export default function TermsPage() {
  const isAdmin = canManageContent(getSession());
  const [allowed, setAllowed] = useState(false);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [removeFileIds, setRemoveFileIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "Company Policies",
    content: "",
  });
  useEffect(() => {
    let cancelled = false;
    setAllowed(isAdmin && canManageContent(getSession()));
    setLoading(true);
    setError("");
    api
      .get<{ terms: Terms | null }>("/terms")
      .then((result) => {
        if (cancelled) return;
        setTerms(result.terms);
        if (result.terms)
          setForm({ title: result.terms.title, content: result.terms.content });
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload, isAdmin]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (files.reduce((total, file) => total + file.size, 0) > 6 * 1024 * 1024) throw new Error("Choose up to 6 MB of documents.");
      const uploads = await Promise.all(files.map(async (file) => {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
          reader.readAsDataURL(file);
        });
        return { name: file.name, data };
      }));
      const result = await api.patch<{ terms: Terms }>("/terms", { ...form, files: uploads, removeFileIds });
      setTerms(result.terms);
      setFiles([]);
      setRemoveFileIds([]);
      setEditing(false);
      setSuccess(
        "Company policies published. All employees in your organization can read them.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const download = async (file: NonNullable<Terms["files"]>[number]) => {
    try {
      const url = URL.createObjectURL(await api.download(`/terms/files/${file.id}`));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const removePolicies = async () => {
    if (!window.confirm("Delete the published company policies?")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.delete("/terms");
      setTerms(null);
      setForm({ title: "Company Policies", content: "" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppShell>
      <PageHeader
        eyebrow="Company policies"
        title="Company Policies"
        description="Your organization’s guidelines, in one place."
        action={
          allowed &&
          !editing && (
            <button
              disabled={loading || saving}
              className="button button-primary"
              onClick={() => {
                setEditing(true);
                setSuccess("");
              }}
            >
              <Pencil size={16} />
              {terms ? "Edit policies" : "Add policies"}
            </button>
          )
        }
      />
      {error && (
        <div className="content-error">
          <ErrorBanner message={error} />
          {!editing && (
            <button
              className="button button-secondary"
              onClick={() => setReload((value) => value + 1)}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {success && (
        <div className="success-banner" role="status">
          {success}
        </div>
      )}
      {loading ? (
        <p role="status">Loading company policies…</p>
      ) : editing ? (
        <form className="card content-editor" onSubmit={submit}>
          <div className="card-header">
            <div className="panel-icon-header">
              <span className="panel-icon"><FileText size={20} /></span>
              <h2>Edit Company Policies</h2>
            </div>
          </div>
          <fieldset disabled={saving} className="content-fields">
            <p className="content-note">
              Saving publishes these policies immediately to all employees.
            </p>
            <div className="field">
              <label htmlFor="terms-title">Title</label>
              <input
                id="terms-title"
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="terms-content">Company Policies</label>
              <textarea
                id="terms-content"
                required
                rows={16}
                maxLength={50000}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <div className="content-actions">
              <label className="field">Policy documents
                <input type="file" multiple accept=".pdf,.doc,.docx" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
              </label>
              {terms?.files?.map((file) => <label key={file.id}>
                <input type="checkbox" checked={removeFileIds.includes(file.id)} onChange={(event) => setRemoveFileIds((ids) => event.target.checked ? [...ids, file.id] : ids.filter((id) => id !== file.id))} /> Remove {file.name}
              </label>)}
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setEditing(false);
                  setFiles([]);
                  setRemoveFileIds([]);
                  setError("");
                  setForm(
                    terms
                      ? { title: terms.title, content: terms.content }
                      : { title: "Company Policies", content: "" },
                  );
                }}
              >
                Cancel
              </button>
              <button className="button button-primary">
                {saving ? "Publishing…" : "Publish policies"}
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        (
          <section className="card">
            {terms ? (
              <>
                <div className="card-header">
                  <div className="panel-icon-header">
                    <span className="panel-icon"><FileText size={20} /></span>
                    <div>
                      <h2>{terms.title}</h2>
                      <p>
                        Last updated{" "}
                        {new Date(terms.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="content-padding content-prose terms-copy">
                  {terms.content}
                  {!!terms.files?.length && <>
                    {terms.files.length > 1 && <button type="button" className="button button-secondary" onClick={() => { void Promise.all(terms.files!.map(download)); }}>Download all documents</button>}
                    <ul>{terms.files.map((file) => <li key={file.id}><button type="button" className="button button-secondary" onClick={() => void download(file)}>{file.name}</button></li>)}</ul>
                  </>}
                </div>
                {allowed && <div className="content-padding"><button type="button" className="button button-secondary" disabled={saving} onClick={() => void removePolicies()}>Delete policies</button></div>}
              </>
            ) : (
              <EmptyState
                title="No company policies published yet"
                description={
                  allowed
                    ? "Add your organization’s policies for employees to read."
                    : "Your administrator has not published company policies yet."
                }
              />
            )}
          </section>
        )
      )}
    </AppShell>
  );
}
