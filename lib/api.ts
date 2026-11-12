import { clearSession, readAuthValue, updateAccessToken } from "@/lib/auth";
import { resolveApiUrl } from "@/lib/apiUrl";

const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL, process.env.NODE_ENV === "production");

type ApiEnvelope<T> = {
  success: boolean;
  code: number;
  message: string;
  data: T;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let refreshing: { token: string; promise: Promise<string> } | null = null;
const authActions = new Set(["/auth/login", "/auth/refresh", "/auth/logout"]);

async function refreshedToken(refreshToken: string): Promise<string> {
  if (refreshing?.token === refreshToken) return refreshing.promise;
  const promise = (async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json", refreshToken }, body: JSON.stringify({ refreshToken }),
    });
    const body = await response.json().catch(() => ({})) as Partial<ApiEnvelope<{ accessToken: string }>>;
    if (!response.ok) throw new ApiError(body.message || "Could not refresh your session", response.status);
    const token = body.data?.accessToken;
    if (typeof token !== "string" || !token) throw new ApiError("Invalid session response", 502);
    // A response from a previous login must never restore credentials after logout.
    if (readAuthValue("hrm_refresh_token") !== refreshToken) throw new ApiError("Session changed", 401);
    updateAccessToken(token);
    return token;
  })();
  const flight = { token: refreshToken, promise };
  refreshing = flight;
  try { return await promise; }
  finally { if (refreshing === flight) refreshing = null; }
}

async function authenticatedFetch(path: string, options: RequestInit, allowRefresh: boolean): Promise<Response> {
  const token = readAuthValue("hrm_token"), refreshToken = readAuthValue("hrm_refresh_token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}`, accessToken: token } : {}),
      ...(refreshToken ? { refreshToken } : {}),
      ...options.headers,
    },
  });
  if (response.status !== 401 || authActions.has(path)) return response;
  if (readAuthValue("hrm_refresh_token") !== refreshToken) throw new ApiError("Session changed", 401);
  if (allowRefresh && refreshToken) {
    try {
      // Another request may already have refreshed this access token.
      if (readAuthValue("hrm_token") === token) await refreshedToken(refreshToken);
      return await authenticatedFetch(path, options, false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && readAuthValue("hrm_refresh_token") === refreshToken) clearSession();
      throw error;
    }
  }
  // No refresh token, or the refreshed token was rejected. Hide all guarded UI.
  if (readAuthValue("hrm_token") === token) clearSession();
  return response;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const response = await authenticatedFetch(path, options, allowRefresh);

  const body = await response.json().catch(() => ({})) as Partial<ApiEnvelope<T>>;
  if (!response.ok) {
    throw new ApiError(body.message || "Request failed", response.status, (body.data || {}) as Record<string, unknown>);
  }
  return body.data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(data || {}) }),
  patch: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(data || {}) }),
  delete: <T>(path: string, data?: unknown) => apiRequest<T>(path, { method: "DELETE", ...(data ? { body: JSON.stringify(data) } : {}) }),
  download: async (path: string) => {
    const response = await authenticatedFetch(path, {}, true);
    if (!response.ok) throw new ApiError("Could not download attachment", response.status);
    return response.blob();
  },
};
