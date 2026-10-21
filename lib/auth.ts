export type SessionUser = {
  userId: string;
  employeeId?: string;
  organizationId?: string;
  loginId: string;
  permissions: string[];
  accountType: "admin" | "employee";
};

export const saveSession = (accessToken: string, refreshToken: string, user: SessionUser) => {
  localStorage.setItem("hrm_token", accessToken);
  localStorage.setItem("hrm_refresh_token", refreshToken);
  localStorage.setItem("hrm_user", JSON.stringify(user));
  document.cookie = `hrm_account_type=${user.accountType}; path=/; SameSite=Lax`;
};

export const updateAccessToken = (accessToken: string) => {
  localStorage.setItem("hrm_token", accessToken);
};

export const getSession = (): SessionUser | null => {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem("hrm_user");
  return value ? JSON.parse(value) : null;
};

export const clearSession = () => {
  localStorage.removeItem("hrm_token");
  localStorage.removeItem("hrm_refresh_token");
  localStorage.removeItem("hrm_user");
  document.cookie = "hrm_account_type=; path=/; Max-Age=0; SameSite=Lax";
};
