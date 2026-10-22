"use client";

import { FormEvent, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LockKeyhole, Eye, EyeOff } from "lucide-react";
import AppShell from "@/components/AppShell";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { errorMessage } from "@/lib/workspace";

export default function PasswordPage() {
  const isAdmin = usePathname().startsWith("/admin");
  const router = useRouter();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.newPassword !== form.confirmPassword)
      return setError("New passwords do not match.");
    if (
      form.newPassword.length < 8 ||
      new TextEncoder().encode(form.newPassword).length > 72
    )
      return setError(
        "Use at least 8 characters and no more than 72 UTF-8 bytes.",
      );
    setSaving(true);
    try {
      await api.post("/auth/change-password", form);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      clearSession();
      router.replace(
        (isAdmin ? "/admin/login" : "/login") + "?passwordChanged=1",
      );
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };
  return (
    <AppShell>
      <PageHeader
        eyebrow="Account security"
        title="Change password"
        description="Keep your Be My Admin account secure."
      />
      <form className="card password-card centered-page" onSubmit={submit}>
        <div className="card-header">
          <div className="panel-icon-header">
            <span className="panel-icon"><LockKeyhole size={20} /></span>
            <div>
              <h2>Your password</h2>
              <p>You’ll sign in again after updating it.</p>
            </div>
          </div>
        </div>
        <fieldset disabled={saving} className="content-fields">
          {error && <ErrorBanner message={error} />}
          {(["currentPassword", "newPassword", "confirmPassword"] as const).map(
            (key) => (
              <div className="field" key={key}>
                <label htmlFor={key}>
                  {key === "currentPassword"
                    ? "Current password"
                    : key === "newPassword"
                      ? "New password"
                      : "Confirm new password"}
                </label>
                <input
                  id={key}
                  type={show ? "text" : "password"}
                  required
                  minLength={key === "currentPassword" ? undefined : 8}
                  autoComplete={
                    key === "currentPassword"
                      ? "current-password"
                      : "new-password"
                  }
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ),
          )}
          <button
            type="button"
            className="password-visibility"
            onClick={() => setShow((value) => !value)}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
            {show ? "Hide passwords" : "Show passwords"}
          </button>
          <p className="content-note">
            Use at least 8 characters. All existing sessions will be signed out.
          </p>
          <button className="button button-primary" disabled={saving}>
            {saving ? "Updating…" : "Update password"}
          </button>
        </fieldset>
      </form>
    </AppShell>
  );
}
