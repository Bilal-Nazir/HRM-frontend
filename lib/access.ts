import { SessionUser } from "@/lib/auth";
export const hasPermission = (user: SessionUser | null, permission: string) => !!user?.permissions.some((value) => value === "*" || value === permission);
export const isCompanyAdministrator = (user: SessionUser | null) => !!(user?.isPlatformAdmin || user?.isCompanyOwner);
export const canManageProjects = (user: SessionUser | null) => isCompanyAdministrator(user) || hasPermission(user, "project.manage");
export const canViewCompanyReports = (user: SessionUser | null) => hasPermission(user, "employee.read.all") && hasPermission(user, "attendance.read.team");
// This controls URLs only. Company permissions never grant the Super Admin portal.
export const portalPrefix = (user: SessionUser | null) => user?.isPlatformAdmin === true ? "/admin" : "";
