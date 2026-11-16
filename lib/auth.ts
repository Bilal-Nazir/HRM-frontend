export type SessionUser = {
  userId: string;
  email?: string;
  name?: string;
  isPlatformAdmin?: boolean;
  isCompanyOwner?: boolean;
  companyName?: string;
  companySlug?: string;
  employeeId?: string;
  organizationId?: string;
  loginId: string;
  permissions: string[];
  // Portal identity; a company admin uses the employee/user portal.
  accountType: "admin" | "employee";
  photoVersion?: string;
};

export const SESSION_CHANGED_EVENT = "hrm-session-changed";
export const sessionKeys = ["hrm_token", "hrm_refresh_token", "hrm_user"];
const notifySessionChanged = () => window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));

export const isSessionUser = (value: unknown): value is SessionUser => {
  if (!value || typeof value !== "object") return false;
  const user = value as SessionUser;
  return typeof user.userId === "string" && !!user.userId && typeof user.loginId === "string" && !!user.loginId &&
    ["admin", "employee"].includes(user.accountType) && Array.isArray(user.permissions) && user.permissions.every((permission) => typeof permission === "string") &&
    (user.employeeId === undefined || typeof user.employeeId === "string") && (user.organizationId === undefined || typeof user.organizationId === "string");
};

export const readAuthValue = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(key); } catch { return null; }
};

const syncPortalCookie = (user: SessionUser) => {
  document.cookie = `hrm_account_type=${user.isPlatformAdmin === true ? "admin" : "employee"}; path=/; SameSite=Lax`;
};

export const saveSession = (accessToken: string, refreshToken: string, user: SessionUser) => {
  localStorage.setItem("hrm_token", accessToken);
  localStorage.setItem("hrm_refresh_token", refreshToken);
  localStorage.setItem("hrm_user", JSON.stringify(user));
  syncPortalCookie(user);
  notifySessionChanged();
};

export const updateAccessToken = (accessToken: string) => {
  localStorage.setItem("hrm_token", accessToken);
};

export const getSession = (): SessionUser | null => {
  try {
    const user: unknown = JSON.parse(readAuthValue("hrm_user") || "null");
    return isSessionUser(user) ? user : null;
  } catch { return null; }
};

// Server-verified profile changes are saved before protected pages mount.
export const updateSessionUser = (user: SessionUser) => {
  localStorage.setItem("hrm_user", JSON.stringify(user));
  syncPortalCookie(user);
};

export const clearSession = () => {
  if (typeof window === "undefined") return;
  const hadSession = sessionKeys.some((key) => readAuthValue(key) !== null) || document.cookie.includes("hrm_account_type=");
  try { sessionKeys.forEach((key) => localStorage.removeItem(key)); } catch { /* Storage may be disabled. The guard remains closed. */ }
  document.cookie = "hrm_account_type=; path=/; Max-Age=0; SameSite=Lax";
  if (hadSession) notifySessionChanged();
};
