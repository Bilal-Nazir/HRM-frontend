import { taskReturnPath } from "@/lib/taskLinks";

export type Portal = "admin" | "employee";
const employeePages = ["/dashboard", "/employees", "/projects", "/chat", "/attendance", "/leave", "/announcements", "/terms", "/settings", "/hiring"];

export const dashboardHref = (portal: Portal) => portal === "admin" ? "/admin/dashboard" : "/dashboard";
export const isAccountPath = (path: string) => ["/companies", "/join"].includes(path);
export const portalForUser = (user: { isPlatformAdmin?: boolean }): Portal => user.isPlatformAdmin === true ? "admin" : "employee";
export const sessionHome = (user: { organizationId?: string; accountType: Portal; isPlatformAdmin?: boolean }) => user.organizationId ? dashboardHref(portalForUser(user)) : "/companies";
export const isLoginPath = (path: string) => path === "/login" || path === "/admin/login";
export const isEntryPath = (path: string) => path === "/" || path === "/admin" || isLoginPath(path);

export function protectedPortal(path: string): Portal | null {
  if (isEntryPath(path)) return null;
  if (path.startsWith("/admin/")) return "admin";
  return employeePages.some((page) => path === page || path.startsWith(`${page}/`)) ? "employee" : null;
}

// Preserve internal destinations and filters, never a login page or external URL.
export function authReturnPath(value: string | null, portal: Portal): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  const task = taskReturnPath(value, portal === "admin");
  if (task) return task;
  try {
    const url = new URL(value, "https://hrm.invalid");
    if (!isAccountPath(url.pathname) && protectedPortal(url.pathname) && protectedPortal(url.pathname) !== portal) url.pathname = portal === "admin" ? `/admin${url.pathname}` : url.pathname.replace(/^\/admin(?=\/)/, "");
    if (url.origin !== "https://hrm.invalid" || !/^\/[a-z\d/_-]+$/i.test(url.pathname) || (!isAccountPath(url.pathname) && protectedPortal(url.pathname) !== portal)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function loginHref(pathname: string, search = "") {
  const portal = pathname === "/admin" || pathname.startsWith("/admin/") ? "admin" : "employee";
  const next = authReturnPath(`${pathname}${search}`, portal);
  return `${portal === "admin" ? "/admin/login" : "/login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
}

export function authenticatedRedirect(pathname: string, search: string, portal: Portal): string | null {
  if (isEntryPath(pathname)) return authReturnPath(new URLSearchParams(search).get("next"), portal) || dashboardHref(portal);
  if (protectedPortal(pathname) && protectedPortal(pathname) !== portal) {
    return authReturnPath(`${pathname}${search}`, portal) || dashboardHref(portal);
  }
  return null;
}
