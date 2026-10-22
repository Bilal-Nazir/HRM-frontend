"use client";

import { FormEvent, useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";
import { Employee } from "@/types";

export default function AdminProfileSettingsPage() {
  const [profile, setProfile] = useState<Employee | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ employee: Employee }>("/employee/me")
      .then(({ employee }) => {
        setProfile(employee);
        setFirstName(employee.firstName);
        setLastName(employee.lastName);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const result = await api.patch<{ employee: Employee }>("/employee/me", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setProfile(result.employee);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell employee={profile}>
      <PageHeader
        eyebrow="Account settings"
        title="Admin profile"
        description="Set the name shown in your dashboard greeting and account menu."
      />
      <form className="card password-card centered-page" onSubmit={submit}>
        <div className="card-header">
          <div className="panel-icon-header">
            <span className="panel-icon"><UserRound size={20} /></span>
            <div><h2>Display name</h2><p>This name is visible in your admin workspace.</p></div>
          </div>
        </div>
        <fieldset disabled={loading || saving} className="content-fields">
          {error && <ErrorBanner message={error} />}
          {saved && <div className="success-banner" role="status">Profile name updated.</div>}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input id="firstName" required maxLength={64} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" required maxLength={64} value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
          </div>
          <button className="button button-primary" type="submit" disabled={loading || saving || !firstName.trim() || !lastName.trim()}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </fieldset>
      </form>
    </AppShell>
  );
}
