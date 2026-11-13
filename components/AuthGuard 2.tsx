"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { verifySession } from "@/lib/verifySession";
import { clearSession, getSession, isSessionUser, readAuthValue, SESSION_CHANGED_EVENT, sessionKeys, updateSessionUser } from "@/lib/auth";
import { authenticatedRedirect, isEntryPath, loginHref, protectedPortal } from "@/lib/authRoutes";

type Gate = { path: string; status: "checking" | "ready" | "error" };
const identity = () => `${readAuthValue("hrm_user")}\n${readAuthValue("hrm_refresh_token")}`;

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/", router = useRouter();
  const guarded = !!protectedPortal(pathname) || isEntryPath(pathname);
  const [gate, setGate] = useState<Gate>({ path: "", status: "checking" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const invalidate = () => { setGate({ path: "", status: "checking" }); setRevision((value) => value + 1); };
    const storage = (event: StorageEvent) => {
      // Routine refreshes in another tab should not discard an unsaved form.
      if (event.key === "hrm_token" && event.oldValue && event.newValue) return;
      if (event.key === null || sessionKeys.includes(event.key)) invalidate();
    };
    const show = (event: PageTransitionEvent) => { if (event.persisted) invalidate(); };
    window.addEventListener(SESSION_CHANGED_EVENT, invalidate);
    window.addEventListener("storage", storage);
    window.addEventListener("pageshow", show);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, invalidate);
      window.removeEventListener("storage", storage);
      window.removeEventListener("pageshow", show);
    };
  }, []);

  useEffect(() => {
    if (!guarded) return;
    let active = true;
    setGate({ path: pathname, status: "checking" });
    const search = window.location.search;
    const session = getSession();
    if (!session || !readAuthValue("hrm_token")) {
      clearSession();
      if (isEntryPath(pathname)) setGate({ path: pathname, status: "ready" });
      else router.replace(loginHref(pathname, search));
      return;
    }
    const startedFor = identity();
    void verifySession().then((result) => {
      if (!active || identity() !== startedFor) return;
      if (!isSessionUser(result.user)) throw new Error("Invalid session response");
      updateSessionUser(result.user);
      const destination = authenticatedRedirect(pathname, search, result.user.accountType);
      if (destination) router.replace(destination);
      else setGate({ path: pathname, status: "ready" });
    }).catch((error: unknown) => {
      if (!active || identity() !== startedFor) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        if (isEntryPath(pathname)) setGate({ path: pathname, status: "ready" });
        else router.replace(loginHref(pathname, search));
      } else setGate({ path: pathname, status: "error" });
    });
    return () => { active = false; };
  }, [pathname, guarded, revision, router]);

  // Render no page components (or their effects) until this exact route is checked.
  if (!guarded || (gate.path === pathname && gate.status === "ready")) return children;
  return <main className="auth-gate" aria-busy={gate.status !== "error"}>
    {gate.path === pathname && gate.status === "error" ? <div role="alert"><h1>Unable to verify your session</h1><p>Check your connection and try again.</p><button type="button" className="button button-primary" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>
      : <p role="status">Checking your session…</p>}
  </main>;
}
