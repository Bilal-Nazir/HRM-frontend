"use client";

import {
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Users,
  Megaphone,
  FileText,
  LockKeyhole,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getSession, SessionUser } from "@/lib/auth";
import { Employee } from "@/types";
import { useClientClock } from "@/lib/useClientClock";
import AdminLeaveNotification from "@/components/AdminLeaveNotification";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/attendance", label: "Attendance", icon: Clock3 },
  { href: "/leave", label: "Leave", icon: CalendarDays },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/terms", label: "Terms & Conditions", icon: FileText },
  { href: "/settings/password", label: "Change password", icon: LockKeyhole },
];

export default function AppShell({
  children,
  employee,
}: {
  children: React.ReactNode;
  employee?: Employee | null;
}) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const routePrefix = isAdmin ? "/admin" : "";
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const now = useClientClock();

  useEffect(() => {
    const session = getSession();
    if (!session || !localStorage.getItem("hrm_token")) {
      router.replace(isAdmin ? "/admin/login" : "/login");
      return;
    }
    setUser(session);
  }, [isAdmin, router]);

  const logout = () => {
    clearSession();
    router.replace(isAdmin ? "/admin/login" : "/login");
  };

  return (
    <div className={`app-shell ${isAdmin ? "admin-shell" : "employee-shell"}`}>
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Building2 size={20} />
          </div>
          <div>
            <strong>Be My Admin</strong>
            <span>{isAdmin ? "Administration" : "People workspace"}</span>
          </div>
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="nav-list">
          <p className="nav-label">
            {isAdmin ? "Admin workspace" : "Workspace"}
          </p>
          {navigation
            .filter(
              (item) =>
                item.href !== "/employees" ||
                isAdmin ||
                user?.permissions?.some(
                  (permission) =>
                    permission === "*" || permission === "employee.read.all",
                ),
            )
            .map(({ href, label, icon: Icon }) => {
              const resolvedHref = `${routePrefix}${href}`;
              return (
                <Link
                  key={href}
                  href={resolvedHref}
                  onClick={() => setMobileOpen(false)}
                  className={
                    pathname === resolvedHref ? "nav-item active" : "nav-item"
                  }
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span>{label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-card">
            <div className="avatar">
              {employee
                ? `${employee.firstName?.[0] || ""}${employee.lastName?.[0] || ""}`.toUpperCase()
                : user?.loginId?.slice(0, 2).toUpperCase() || "HR"}
            </div>
            <div className="profile-copy">
              <strong>
                {employee
                  ? `${employee.firstName} ${employee.lastName}`
                  : user?.loginId || "Loading..."}
              </strong>
              <span>
                {isAdmin
                  ? "Platform administrator"
                  : employee?.jobTitle || "Employee workspace"}
              </span>
            </div>
            <ChevronDown size={16} />
          </div>
          <button className="logout-button" onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="sidebar-scrim"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="global-search">
            <Search size={17} />
            <input
              aria-label="Search"
              placeholder="Search employees, requests..."
            />
          </div>
          {isAdmin &&
            user?.permissions.some(
              (permission) =>
                permission === "*" || permission === "leave.manage",
            ) && <AdminLeaveNotification />}
          <div className="topbar-date">
            {now
              ? new Intl.DateTimeFormat("en", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }).format(now)
              : "—"}
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
