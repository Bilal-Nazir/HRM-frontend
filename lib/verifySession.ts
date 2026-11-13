import { api, ApiError } from "@/lib/api";
import { getSession, isSessionUser, readAuthValue, updateAccessToken } from "@/lib/auth";

let legacyBackend = false;

export async function verifySession(): Promise<{ user: unknown }> {
  if (!legacyBackend) {
    try { return await api.get<{ user: unknown }>("/auth/session"); }
    catch (error) {
      // Older deployments verify the same active account and credential version
      // through /auth/refresh. Never fall back after an authentication rejection.
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      legacyBackend = true;
    }
  }
  const current = getSession(), refreshToken = readAuthValue("hrm_refresh_token");
  if (!current || !refreshToken) throw new ApiError("Sign in again to continue", 401);
  const result = await api.post<{ accessToken: string }>("/auth/refresh", { refreshToken });
  if (readAuthValue("hrm_refresh_token") !== refreshToken) throw new ApiError("Session changed", 401);
  // These claims come from the fresh token returned by our authenticated server,
  // never from an old local token or an unverified account-type cookie.
  const token = result.accessToken;
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(encoded)) as Record<string, unknown>;
    const user = {
      userId: claims.userId, loginId: current.loginId, permissions: claims.permissions,
      isPlatformAdmin: claims.isPlatformAdmin === true, isCompanyOwner: claims.isCompanyOwner === true, companyName: claims.companyName, companySlug: claims.companySlug,
      accountType: claims.isPlatformAdmin === true ? "admin" : "employee", employeeId: claims.employeeId, organizationId: claims.organizationId,
    };
    if (!isSessionUser(user) || user.userId !== current.userId || claims.tokenType !== "access" || typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) throw new Error("Invalid token");
    updateAccessToken(token);
    return { user };
  } catch { throw new ApiError("Invalid session response. Sign in again.", 401); }
}
