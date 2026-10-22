"use client";
import "@/app/employee-theme.css";
import "@/app/admin-home.css";
import "@/app/dashboard-engagement.css";
import EmployeeDashboard from "@/components/EmployeeDashboard";
import AdminHome from "@/components/AdminHome";
import { usePathname } from "next/navigation";

export default function DashboardPage() {
  const pathname = usePathname();
  return pathname.startsWith("/admin") ? <AdminHome /> : <EmployeeDashboard />;
}
