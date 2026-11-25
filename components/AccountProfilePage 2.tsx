"use client";
import { FormEvent, useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { SessionUser, updateSessionUser } from "@/lib/auth";
export default function AccountProfileSettingsPage() {
  const [profile, setProfile] = useState<SessionUser | null>(null),
    [name, setName] = useState("");
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    api
      .get<{ user: SessionUser }>("/auth/session")
      .then(({ user }) => {
        setProfile(user);
        setName(user.name || user.loginId);
      })
      .catch((error) =>
        setError(
          error instanceof Error
            ? error.message
            : "Could not load your account",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { user } = await api.patch<{ user: SessionUser }>("/auth/profile", {
        name,
      });
      setProfile(user);
      updateSessionUser(user);
      setSaved(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not update your account",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <AppShell>
      <PageHeader
        eyebrow="Your account"
        title="Profile settings"
        description="Your account belongs to you across all your companies."
      />
      {error && <ErrorBanner message={error} />}{" "}
      {saved && (
        <div className="success-banner" role="status">
          Profile saved.
        </div>
      )}
      {loading ? (
        <p role="status">Loading your account…</p>
      ) : (
        <form className="company-panel company-create" onSubmit={submit}>
          <UserRound size={24} />
          <label>
            Name
            <input
              required
              maxLength={128}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            Email or login
            <input readOnly value={profile?.email || profile?.loginId || ""} />
          </label>
          <button className="button button-primary" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      )}
    </AppShell>
  );
}
