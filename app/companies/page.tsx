"use client";
import { FormEvent, useEffect, useState } from "react";
import { Building2, ArrowRight, Plus, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth";
import { Company, CompanySession, applyCompanySession } from "@/lib/companies";
import { ErrorBanner } from "@/components/ui";
export default function CompaniesPage() {
  const user = getSession();
  const [companies, setCompanies] = useState<Company[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const load = async () => {
    setLoading(true);
    try {
      const result = await api.get<{ companies: Company[] }>("/companies");
      setCompanies(result.companies);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load companies",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  async function enter(company: Company) {
    setBusy(true);
    setError("");
    try {
      applyCompanySession(
        await api.post<CompanySession>(`/companies/${company.id}/switch`),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not open company",
      );
      setBusy(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      applyCompanySession(await api.post<CompanySession>("/companies", form));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create company",
      );
      setBusy(false);
    }
  }
  async function status(company: Company) {
    setBusy(true);
    try {
      await api.patch(`/companies/${company.id}/status`, {
        status: company.status === "active" ? "suspended" : "active",
      });
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update company",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="companies-page">
      <header className="companies-header">
        <div className="brand-row">
          <span className="brand-mark">
            <Building2 size={24} />
          </span>
          <strong>Be My Admin</strong>
        </div>
        <button
          className="button button-secondary"
          onClick={() => {
            clearSession();
            window.location.assign(user?.isPlatformAdmin ? "/admin/login" : "/login");
          }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </header>
      <section className="companies-intro">
        <span className="eyebrow">
          {user?.isPlatformAdmin ? "Platform management" : "Your workspace"}
        </span>
        <h1>
          {user?.isPlatformAdmin ? "All companies" : "Choose your company"}
        </h1>
        <p>
          {user?.name || user?.email || user?.loginId} · Each company has its
          own people, projects and records.
        </p>
        <button
          className="button button-primary"
          onClick={() => setCreating((value) => !value)}
        >
          <Plus size={18} /> Create company
        </button>
      </section>
      {error && <ErrorBanner message={error} />}{" "}
      {creating && (
        <form className="company-panel company-create" onSubmit={create}>
          <h2>Create a company</h2>
          <label>
            Company name
            <input
              required
              maxLength={128}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <label>
            Company ID
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={64}
              placeholder="my-company"
              value={form.slug}
              onChange={(event) =>
                setForm({ ...form, slug: event.target.value.toLowerCase() })
              }
            />
            <small>A unique ID used when signing in with an employee ID.</small>
          </label>
          <label>
            Time zone
            <input
              required
              value={form.timezone}
              onChange={(event) =>
                setForm({ ...form, timezone: event.target.value })
              }
            />
          </label>
          <button className="button button-primary" disabled={busy}>
            Create and open company
          </button>
        </form>
      )}
      <div className="company-grid">
        {companies.map((company) => (
          <article className="company-panel company-tile" key={company.id}>
            <span className="company-tile-icon">
              <Building2 size={25} />
            </span>
            <span className="company-badge">
              {company.isOwner
                ? "Company admin"
                : user?.isPlatformAdmin
                  ? "Super Admin access"
                  : "Member"}
            </span>
            <h2>{company.name}</h2>
            <p>
              {company.slug} · {company.timezone}
            </p>
            <span className="muted">{company.status}</span>
            <button
              className="button button-primary"
              disabled={busy || !company.canEnter}
              onClick={() => void enter(company)}
            >
              Open company <ArrowRight size={16} />
            </button>
            {user?.isPlatformAdmin && company.status !== "provisioning" && (
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => void status(company)}
              >
                {company.status === "active"
                  ? "Suspend company"
                  : "Activate company"}
              </button>
            )}
          </article>
        ))}
      </div>
      {loading && <p role="status">Loading companies…</p>}
      {!loading && !companies.length && (
        <section className="company-panel">
          <h2>Your workspace starts here</h2>
          <p>
            Create your first company, or open an invitation link from your
            company admin.
          </p>
        </section>
      )}
    </main>
  );
}
