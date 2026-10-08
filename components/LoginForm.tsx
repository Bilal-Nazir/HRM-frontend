"use client";

import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { saveSession, SessionUser } from "@/lib/auth";
import { ErrorBanner } from "@/components/ui";

export default function LoginForm({
  adminMode = false,
}: {
  adminMode?: boolean;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);
  useEffect(() => {
    setPasswordChanged(
      new URLSearchParams(window.location.search).get("passwordChanged") ===
        "1",
    );
  }, []);
  const [form, setForm] = useState({
    organizationSlug: "novacto",
    loginId: "",
    password: "",
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: SessionUser;
      }>("/auth/login", form);
      saveSession(result.accessToken, result.refreshToken, result.user);
      router.push(adminMode ? "/admin/dashboard" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-glow login-glow-one" />
        <div className="login-glow login-glow-two" />
        <div className="login-brand">
          <div className="brand-mark brand-letter">B</div>
          <strong>Be My Admin</strong>
        </div>

        <div className="login-message">
          <h1>
            People. Work.
            <br />
            Everything{" "}
            <span>
              togethe
              <span className="butterfly-perch">
                r
                <img
                  src="/images/butterfly-corporate-cartoon-v6.png"
                  alt=""
                  aria-hidden="true"
                />
              </span>
              .
            </span>
          </h1>
          <p>Everything your office needs, in one place.</p>
        </div>
      </section>

      <section className="login-form-side">
        <div className="login-card">
          <div className="mobile-login-brand">
            <div className="brand-mark brand-letter">B</div>
            <strong>Be My Admin</strong>
          </div>
          <span className="eyebrow">Welcome back</span>
          <h2>Welcome back</h2>
          <p>Sign in to continue.</p>
          <div className="workspace-chip">
            <Building2 size={14} />
            <span>NovaCTO</span>
          </div>
          {error && <ErrorBanner message={error} />}
          {passwordChanged && (
            <div className="success-banner" role="status">
              Password updated. Sign in with your new password.
            </div>
          )}
          <form onSubmit={submit}>
            <div className="field">
              <label>Employee ID</label>
              <div className="input-with-icon">
                <UserRound size={17} />
                <input
                  value={form.loginId}
                  onChange={(e) =>
                    setForm({ ...form, loginId: e.target.value })
                  }
                  placeholder="Enter your employee ID"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>Password</label>
              <div className="input-with-icon">
                <LockKeyhole size={17} />
                <input
                  className="password-input"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="Enter your password"
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <label className="remember-me">
              <input type="checkbox" /> <span>Keep me signed in</span>
            </label>
            <button
              className="button button-primary button-block login-submit"
              disabled={loading}
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
