"use client";
import "@/app/employee-theme.css";
import "@/app/admin-home.css";
import "@/app/dashboard-engagement.css";
import "@/app/daily-workspace.css";
import EmployeeDashboard from "@/components/EmployeeDashboard";
import AdminHome from "@/components/AdminHome";
import { getSession } from "@/lib/auth";
import { canViewCompanyReports } from "@/lib/access";

export default function DashboardPage() {
  return canViewCompanyReports(getSession()) ? <AdminHome /> : <EmployeeDashboard />;
}
