"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { CompanySession, applyCompanySession } from "@/lib/companies";
import { getSession } from "@/lib/auth";
export default function JoinCompany() {
  const [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);
  async function accept() {
    setBusy(true);
    try {
      applyCompanySession(
        await api.post<CompanySession>("/companies/invitations/accept", {
          token,
        }),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not accept invitation",
      );
      setBusy(false);
    }
  }
  return (
    <main className="companies-page">
      <section className="company-panel company-create">
        <h1>Join your company</h1>
        <p>
          Signed in as {getSession()?.email || getSession()?.loginId}. Use the
          email address your company admin invited.
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          className="button button-primary"
          disabled={busy || !token}
          onClick={() => void accept()}
        >
          {busy ? "Joining…" : "Accept invitation"}
        </button>
        <Link href="/companies">Back to companies</Link>
      </section>
    </main>
  );
}
