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
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getSession, SessionUser } from "@/lib/auth";
import { Employee } from "@/types";
import { useClientClock } from "@/lib/useClientClock";
import AdminLeaveNotification from "@/components/AdminLeaveNotification";
import { api } from "@/lib/api";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/attendance", label: "Attendance", icon: Clock3 },
  { href: "/leave", label: "Requests", icon: CalendarDays },
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
  const [profile, setProfile] = useState<Employee | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [employeeResults, setEmployeeResults] = useState<Employee[]>([]);
  const now = useClientClock();

  useEffect(() => {
    const session = getSession();
    if (!session || !localStorage.getItem("hrm_token")) {
      router.replace(isAdmin ? "/admin/login" : "/login");
      return;
    }
    const expectedAccountType = isAdmin ? "admin" : "employee";
    if (session.accountType !== expectedAccountType) {
      router.replace(
        session.accountType === "admin" ? "/admin/dashboard" : "/dashboard",
      );
      return;
    }
    setUser(session);
    api.get<{ employee: Employee }>("/employee/me").then((result) => setProfile(result.employee)).catch(() => setProfile(null));
  }, [isAdmin, router]);

  useEffect(() => {
    if (!query.trim() || !isAdmin) { setEmployeeResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(() => api.get<{ employees: Employee[] }>(`/employee/view?size=5&search=${encodeURIComponent(query.trim())}`).then((result) => { if (!cancelled) setEmployeeResults(result.employees || []); }).catch(() => { if (!cancelled) setEmployeeResults([]); }), 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, isAdmin]);

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
          <button className="profile-card profile-trigger" type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}>
            <div className="avatar">
              {(employee || profile)
                ? `${(employee || profile)?.firstName?.[0] || ""}${(employee || profile)?.lastName?.[0] || ""}`.toUpperCase()
                : user?.loginId?.slice(0, 2).toUpperCase() || "HR"}
            </div>
            <div className="profile-copy">
              <strong>
                {(employee || profile)
                  ? `${(employee || profile)?.firstName} ${(employee || profile)?.lastName}`
                  : user?.loginId || "Loading..."}
              </strong>
              <span>
                {isAdmin
                  ? "Platform administrator"
                  : (employee || profile)?.jobTitle || "Employee workspace"}
              </span>
            </div>
            <ChevronDown size={16} />
          </button>
          {profileOpen && <div className="profile-menu"><span>{profile?.workEmail || user?.loginId}</span><Link href={`${routePrefix}/settings/password`} onClick={() => setProfileOpen(false)}>Change password</Link><button type="button" onClick={logout}>Sign out</button></div>}
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
          <button className="icon-button back-button" aria-label="Go back" title="Go back" onClick={() => window.history.length > 1 ? router.back() : router.push(`${routePrefix}/dashboard`)}><ArrowLeft size={19} /></button>
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
              placeholder={isAdmin ? "Search pages or employees..." : "Search pages..."}
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
              onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); if (event.key === "Enter") { const match = navigation.find((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())); if (match && query.trim()) { router.push(`${routePrefix}${match.href}`); setSearchOpen(false); } } }}
            />
            {searchOpen && query.trim() && <div className="search-results" role="listbox">
              {navigation.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()) && (isAdmin || item.href !== "/employees")).map((item) => <button key={item.href} type="button" onClick={() => { router.push(`${routePrefix}${item.href}`); setSearchOpen(false); setQuery(""); }}>{item.label}<small>Page</small></button>)}
              {employeeResults.map((item) => <button key={item.id} type="button" onClick={() => { router.push(`/admin/employees?search=${encodeURIComponent(item.employeeCode)}`); setSearchOpen(false); setQuery(""); }}>{item.firstName} {item.lastName}<small>{item.employeeCode}</small></button>)}
              {!navigation.some((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())) && !employeeResults.length && <span>No matches</span>}
            </div>}
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
