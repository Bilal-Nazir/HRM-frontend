const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

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
    if (typeof window !== "undefined")
      window.location.assign(window.location.pathname.startsWith("/admin") ? "/admin/login" : "/login");
  }
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
    const token = localStorage.getItem("hrm_token");
    const response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new ApiError("Could not download attachment", response.status);
    return response.blob();
  },
};
