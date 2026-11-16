"use client";
import { ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { saveSession, SessionUser } from "@/lib/auth";
import { errorMessage } from "@/lib/workspace";
import { ErrorBanner } from "@/components/ui";

export default function ChatCompanyGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null),
    [companies, setCompanies] = useState<
      { id: string; name: string; canEnter: boolean }[]
    >([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ user: SessionUser }>("/auth/session")
      .then(async ({ user }) => {
        if (cancelled) return;
        setUser(user);
        const result = await api.get<{ companies: typeof companies }>(
          "/companies",
        );
        if (!cancelled)
          setCompanies(result.companies.filter((company) => company.canEnter));
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function enter(id: string) {
    if (!id || busy || id === user?.organizationId) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{
        user: SessionUser;
        accessToken: string;
        refreshToken: string;
      }>(`/companies/${id}/switch`, {
        refreshToken: localStorage.getItem("hrm_refresh_token"),
      });
      saveSession(result.accessToken, result.refreshToken, result.user);
      // Reload intentionally: discard old-company rooms, drafts and inbox data.
      window.location.assign(
        `${result.user.accountType === "admin" ? "/admin" : ""}/chat?new=1`,
      );
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <>
      {error && <ErrorBanner message={error} />}
      {!user && !error && <div className="loading-line" />}
      {user && (
        <section className="chat-company-selector">
          <label htmlFor="chat-company">Search employees in</label>
          <select
            id="chat-company"
            value={user.organizationId || ""}
            disabled={busy}
            onChange={(event) => void enter(event.target.value)}
          >
            <option value="" disabled>
              {busy ? "Opening…" : "Choose a company"}
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
            {user.organizationId &&
              !companies.some(
                (company) => company.id === user.organizationId,
              ) && (
                <option value={user.organizationId}>
                  {user.companyName || "Current company"}
                </option>
              )}
          </select>
          {busy && <span role="status">Opening company inbox…</span>}
        </section>
      )}
      {user && !user.organizationId && (
        <section className="card chat-start-company">
          <h1>Send a message</h1>
          <p>
            Choose a company above, then select New conversation and the person
            you want to message.
          </p>
          {!companies.length && (
            <p>No companies are available for this account.</p>
          )}
        </section>
      )}
      {user?.organizationId && children}
    </>
  );
}
