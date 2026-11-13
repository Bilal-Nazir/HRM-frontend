"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CompanySession } from "@/lib/companies";

type GoogleApi = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        nonce: string;
        callback: (response: { credential: string }) => void;
      }): void;
      renderButton(
        element: HTMLElement,
        options: Record<string, unknown>,
      ): void;
    };
  };
};
export default function GoogleSignIn({
  onSuccess,
  onError,
  portal = "employee",
}: {
  portal?: "admin" | "employee";
  onSuccess: (result: CompanySession) => void;
  onError: (message: string) => void;
}) {
  const [enabled, setEnabled] = useState(false),
    [loaded, setLoaded] = useState(false),
    [revision, setRevision] = useState(0),
    [linking, setLinking] = useState(false),
    [busy, setBusy] = useState(false);
  const container = useRef<HTMLDivElement>(null),
    password = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onSuccess, onError });
  callbacks.current = { onSuccess, onError };
  useEffect(() => {
    let active = true;
    api
      .get<{ enabled: boolean }>("/auth/google/config")
      .then((result) => {
        if (active) setEnabled(result.enabled);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!enabled || !loaded) return;
    let active = true;
    api
      .get<{ clientId: string; nonce: string }>("/auth/google/challenge")
      .then(({ clientId, nonce }) => {
        const google = (window as unknown as { google?: GoogleApi }).google;
        if (!active || !google || !container.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          nonce,
          callback: async ({ credential }) => {
            if (!active) return;
            setBusy(true);
            try {
              const result = await api.post<CompanySession>("/auth/google", {
                credential,
                nonce,
                portal,
                ...(password.current?.value && {
                  existingPassword: password.current.value,
                }),
              });
              if (active) callbacks.current.onSuccess(result);
            } catch (error) {
              if (!active) return;
              const message =
                error instanceof Error
                  ? error.message
                  : "Google sign-in failed";
              setLinking(message.includes("existing password"));
              callbacks.current.onError(message);
              setRevision((value) => value + 1);
            } finally {
              if (active) setBusy(false);
            }
          },
        });
        container.current.replaceChildren();
        google.accounts.id.renderButton(container.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 320,
        });
      })
      .catch((error) => {
        if (active)
          callbacks.current.onError(
            error instanceof Error
              ? error.message
              : "Could not load Google sign-in",
          );
      });
    return () => {
      active = false;
    };
  }, [enabled, loaded, revision, portal]);
  if (!enabled) return null;
  return (
    <section className="google-signin">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
        onError={() =>
          onError(
            "Could not load Google sign-in. Check your connection or use your password.",
          )
        }
      />
      {linking && (
        <label className="field">
          Existing account password
          <input
            type="password"
            autoComplete="current-password"
            ref={password}
          />
          <small>
            Enter your current password, then continue with Google again to
            connect your account.
          </small>
        </label>
      )}
      <div ref={container} aria-label="Continue with Google" aria-busy={busy} />
      {busy && <p role="status">Signing in…</p>}
      <p>{portal === "admin" ? "Access is limited to existing Super Admin accounts." : "New here? Continue with Google to create your account and company."}</p>
      <div className="login-divider">or use your existing login</div>
    </section>
  );
}
