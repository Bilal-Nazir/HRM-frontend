"use client";
import { getSession } from "@/lib/auth";
import PersonalRequestsPage from "@/components/PersonalRequestsPage";
import CompanyRequestsPage from "@/components/CompanyRequestsPage";
import { hasPermission } from "@/lib/access";
const canManageRequests = (user: ReturnType<typeof getSession>) => hasPermission(user, "leave.manage");
export default function Page() { return canManageRequests(getSession()) ? <CompanyRequestsPage/> : <PersonalRequestsPage/>; }
