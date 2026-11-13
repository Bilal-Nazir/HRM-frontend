import { saveSession, SessionUser } from "@/lib/auth";
import { sessionHome } from "@/lib/authRoutes";
export type Company = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: string;
  isOwner: boolean;
  canEnter: boolean;
  ownerUserId?: string;
};
export type CompanySession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};
export function applyCompanySession(result: CompanySession) {
  saveSession(result.accessToken, result.refreshToken, result.user);
  // A new document clears component state, pending forms, timers and API caches.
  window.location.assign(sessionHome(result.user));
}
