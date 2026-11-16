import { taskReturnPath } from "@/lib/taskLinks";

const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() || "https://3.126.250.133/api").replace(/\/+$/, "");

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

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("hrm_token") : null;
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem("hrm_refresh_token") : null;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}`, accessToken: token } : {}),
      ...(refreshToken ? { refreshToken } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({})) as Partial<ApiEnvelope<T>>;
  if (response.status === 401 && allowRefresh && refreshToken && path !== "/auth/refresh") {
    const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", refreshToken },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshBody = await refreshResponse.json().catch(() => ({})) as Partial<ApiEnvelope<{ accessToken: string }>>;
    const nextAccessToken = refreshBody.data?.accessToken;
    if (refreshResponse.ok && nextAccessToken) {
      localStorage.setItem("hrm_token", nextAccessToken);
      return apiRequest<T>(path, options, false);
    }
    localStorage.removeItem("hrm_token");
    localStorage.removeItem("hrm_refresh_token");
    localStorage.removeItem("hrm_user");
    if (typeof window !== "undefined") {
      const admin = window.location.pathname.startsWith("/admin");
      const next = taskReturnPath(`${window.location.pathname}${window.location.search}`, admin);
      window.location.assign(`${admin ? "/admin/login" : "/login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    }
  }
  if (!response.ok) {
    const missingRoute = response.status === 404 && !body.message;
    throw new ApiError(body.message || (missingRoute ? "This API route is unavailable. Check that the frontend is connected to the updated backend." : `Request failed (${response.status})`), response.status, (body.data || {}) as Record<string, unknown>);
  }
  return body.data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(data || {}) }),
  patch: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(data || {}) }),
  put: <T>(path: string, data?: unknown) =>
    apiRequest<T>(path, { method: "PUT", body: JSON.stringify(data || {}) }),
  delete: <T>(path: string, data?: unknown) => apiRequest<T>(path, { method: "DELETE", ...(data ? { body: JSON.stringify(data) } : {}) }),
  download: async (path: string) => {
    const request = () => { const token = localStorage.getItem("hrm_token"); return fetch(`${API_URL}${path}`, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} }); };
    let response = await request();
    if (response.status === 401) { await apiRequest("/auth/session"); response = await request(); }
    if (!response.ok) throw new ApiError("Could not download attachment", response.status);
    return response.blob();
  },
};
