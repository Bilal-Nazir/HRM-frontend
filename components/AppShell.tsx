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
  UserRound,
  Megaphone,
  FileText,
  LockKeyhole,
  X,
  ArrowLeft,
  Palette,
  FolderKanban,
  CalendarRange,
  ListTodo,
  Plus,
  MessageSquare,
  Settings,
  BriefcaseBusiness,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasPermission } from "@/lib/access";
import { clearSession, getSession, SessionUser } from "@/lib/auth";
import { Employee, Project } from "@/types";
import { useClientClock } from "@/lib/useClientClock";
import CompanySwitcher from "@/components/CompanySwitcher";
import NotificationCenter from "@/components/NotificationCenter";
import ChatProvider from "@/components/ChatProvider";
import ChatLauncher from "@/components/ChatLauncher";
import Avatar from "@/components/Avatar";
import { api } from "@/lib/api";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/chat", label: "Inbox", icon: MessageSquare },
  { href: "/attendance", label: "Attendance", icon: Clock3 },
  { href: "/leave", label: "Requests", icon: CalendarDays },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/terms", label: "Company policies", icon: FileText },
];
const personalSettings = [
  { href: "/settings/profile", label: "Profile settings", icon: UserRound },
  { href: "/settings/theme", label: "Appearance", icon: Palette },
  { href: "/settings/password", label: "Change password", icon: LockKeyhole },
];
type Shortcut = {
  href: string;
  label: string;
  kind: "board" | "calendar" | "tasks";
};

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [shortcutPickerOpen, setShortcutPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    () => pathname.startsWith(`${routePrefix}/settings`),
  );
  const now = useClientClock();
  const canSearchEmployees = hasPermission(user, "employee.read.all");
  const companySettings = [
    ...(user?.isCompanyOwner || user?.isPlatformAdmin
      ? [
          {
            href: "/settings/company",
            label: "Company settings",
            icon: Building2,
          },
        ]
      : []),
  ];
  const workspaceNavigation = [
    ...navigation,
    ...(user?.isCompanyOwner || user?.isPlatformAdmin
      ? [{ href: "/hiring", label: "Hiring", icon: BriefcaseBusiness },
         { href: "/attendance/standup", label: "Daily stand-up", icon: CalendarDays }]
      : []),
  ];
  const searchPages = [...workspaceNavigation, ...companySettings, ...personalSettings];

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    setUser(session);
    api
      .get<{ user: SessionUser }>("/auth/profile")
      .then(({ user }) => setUser(user))
      .catch(() => {});
    api
      .get<{ employee: Employee }>("/employee/me")
      .then((result) => setProfile(result.employee))
      .catch(() => setProfile(null));
    api
      .get<{ projects: Project[] }>("/projects?size=50")
      .then((result) => setProjects(result.projects || []))
      .catch(() => setProjects([]));
    try {
      setShortcuts(
        JSON.parse(
          localStorage.getItem(
            `hrm_shortcuts_${session.organizationId}_${session.userId}`,
          ) || "[]",
        ).slice(0, 3),
      );
    } catch {
      setShortcuts([]);
    }
  }, [isAdmin, router]);

  useEffect(() => {
    const updated = () => setUser(getSession());
    window.addEventListener("hrm-profile-updated", updated);
    return () => window.removeEventListener("hrm-profile-updated", updated);
  }, []);

  const toggleShortcut = (shortcut: Shortcut) => {
    if (!user) return;
    const exists = shortcuts.some((item) => item.href === shortcut.href);
    const next = exists
      ? shortcuts.filter((item) => item.href !== shortcut.href)
      : shortcuts.length < 3
        ? [...shortcuts, shortcut]
        : shortcuts;
    setShortcuts(next);
    localStorage.setItem(
      `hrm_shortcuts_${user.organizationId}_${user.userId}`,
      JSON.stringify(next),
    );
  };

  useEffect(() => {
    if (!query.trim() || !canSearchEmployees) {
      setEmployeeResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(
      () =>
        api
          .get<{ employees: Employee[] }>(
            `/employee/view?size=5&search=${encodeURIComponent(query.trim())}`,
          )
          .then((result) => {
            if (!cancelled) setEmployeeResults(result.employees || []);
          })
          .catch(() => {
            if (!cancelled) setEmployeeResults([]);
          }),
      250,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, canSearchEmployees]);

  useEffect(() => {
    if (!shortcutPickerOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShortcutPickerOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [shortcutPickerOpen]);

  const logout = () => {
    clearSession();
    router.replace(isAdmin ? "/admin/login" : "/login");
  };

  return (
    <ChatProvider
      scope={
        user?.organizationId ? `${user.organizationId}:${user.userId}` : ""
      }
    >
      <div
        className={`app-shell ${isAdmin ? "admin-shell" : "employee-shell"}`}
      >
        <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
          <div className="brand-row">
            <div className="brand-mark">
              <Building2 size={20} />
            </div>
            <div>
              <strong>Be My Admin</strong>
              <span>
                {user?.isPlatformAdmin
                  ? "Super Admin"
                  : user?.isCompanyOwner
                    ? "Company workspace"
                    : "People workspace"}
              </span>
            </div>
            <button
              className="icon-button mobile-only"
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          <CompanySwitcher />
          <nav className="nav-list">
            <p className="nav-label">
              {user?.isPlatformAdmin
                ? "Super Admin workspace"
                : user?.isCompanyOwner
                  ? "Company management"
                  : "Workspace"}
            </p>
            {workspaceNavigation
              .filter(
                (item) =>
                  item.href !== "/employees" ||
                  canSearchEmployees ||
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
            <div className="sidebar-settings">
              <button
                type="button"
                className={`sidebar-settings-toggle ${settingsOpen ? "active" : ""}`}
                aria-expanded={settingsOpen}
                aria-controls="sidebar-settings-options"
                onClick={() => {
                  setSettingsOpen((open) => !open);
                  setProfileOpen(false);
                }}
              >
                <Settings size={18} />
                <span>Settings</span>
                <ChevronDown size={15} />
              </button>
              {settingsOpen && (
                <div
                  id="sidebar-settings-options"
                  className="sidebar-settings-options"
                >
                  <span className="sidebar-settings-group">Company</span>
                  {companySettings.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={`${routePrefix}${href}`}
                      className={
                        pathname === `${routePrefix}${href}` ? "active" : ""
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={15} />
                      {label}
                    </Link>
                  ))}
                  <span className="sidebar-settings-group">Personal</span>
                  {personalSettings.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={`${routePrefix}${href}`}
                      className={
                        pathname === `${routePrefix}${href}` ? "active" : ""
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={15} />
                      {label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setShortcutPickerOpen(true);
                      setSettingsOpen(false);
                    }}
                  >
                    <Plus size={15} />
                    Manage shortcuts
                  </button>
                </div>
              )}
            </div>
            <div className="sidebar-quick-icons" aria-label="Project shortcuts">
              {Array.from({ length: 3 }, (_, index) => {
                const shortcut = shortcuts[index];
                if (!shortcut)
                  return (
                    <button
                      key={`empty-${index}`}
                      type="button"
                      className="quick-icon empty"
                      title="Choose a project shortcut"
                      aria-label={`Add shortcut ${index + 1}`}
                      onClick={() => setShortcutPickerOpen(true)}
                    >
                      <Plus size={15} />
                    </button>
                  );
                const Icon =
                  shortcut.kind === "calendar"
                    ? CalendarRange
                    : shortcut.kind === "tasks"
                      ? ListTodo
                      : FolderKanban;
                return (
                  <Link
                    key={shortcut.href}
                    href={`${routePrefix}${shortcut.href}`}
                    className="quick-icon"
                    title={shortcut.label}
                    aria-label={shortcut.label}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={16} />
                  </Link>
                );
              })}
              {shortcutPickerOpen && (
                <div className="shortcut-picker">
                  <header>
                    <strong>Choose shortcuts</strong>
                    <span>{shortcuts.length}/3</span>
                  </header>
                  <p>Pin a project board, task list or calendar.</p>
                  <div>
                    {projects
                      .flatMap((project) => [
                        {
                          href: `/projects/${project.id}/board`,
                          label: `${project.key} board`,
                          kind: "board" as const,
                        },
                        {
                          href: `/projects/${project.id}?view=tasks`,
                          label: `${project.key} tasks`,
                          kind: "tasks" as const,
                        },
                        {
                          href: `/projects/${project.id}?view=calendar`,
                          label: `${project.key} calendar`,
                          kind: "calendar" as const,
                        },
                      ])
                      .map((shortcut) => {
                        const checked = shortcuts.some(
                          (item) => item.href === shortcut.href,
                        );
                        return (
                          <label
                            key={shortcut.href}
                            className={checked ? "selected" : ""}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!checked && shortcuts.length >= 3}
                              onChange={() => toggleShortcut(shortcut)}
                            />
                            <span>{shortcut.label}</span>
                          </label>
                        );
                      })}
                  </div>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setShortcutPickerOpen(false)}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
            <button
              className="profile-card profile-trigger"
              type="button"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((value) => !value)}
            >
              <Avatar
                userId={user?.userId}
                version={user?.photoVersion}
                name={
                  employee || profile
                    ? `${(employee || profile)?.firstName || ""} ${(employee || profile)?.lastName || ""}`
                    : user?.name || user?.loginId || "HR"
                }
              />
              <div className="profile-copy">
                <strong>
                  {employee || profile
                    ? `${(employee || profile)?.firstName} ${(employee || profile)?.lastName}`
                    : user?.name || user?.loginId || "Loading..."}
                </strong>
                <span>
                  {user?.isPlatformAdmin
                    ? "Super Admin"
                    : user?.isCompanyOwner
                      ? "Company admin"
                      : (employee || profile)?.jobTitle || "Employee workspace"}
                </span>
              </div>
              <ChevronDown size={16} />
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <span>{profile?.workEmail || user?.loginId}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(true);
                    setProfileOpen(false);
                  }}
                >
                  <Settings size={15} />
                  Settings
                </button>
                <button type="button" onClick={logout}>
                  Sign out
                </button>
              </div>
            )}
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
              className="icon-button back-button"
              aria-label="Go back"
              title="Go back"
              onClick={() =>
                window.history.length > 1
                  ? router.back()
                  : router.push(`${routePrefix}/dashboard`)
              }
            >
              <ArrowLeft size={19} />
            </button>
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
                placeholder={
                  canSearchEmployees
                    ? "Search pages or employees..."
                    : "Search pages..."
                }
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                  if (event.key === "Enter") {
                    const match = searchPages.find((item) =>
                      item.label
                        .toLowerCase()
                        .includes(query.trim().toLowerCase()),
                    );
                    if (match && query.trim()) {
                      router.push(`${routePrefix}${match.href}`);
                      setSearchOpen(false);
                    }
                  }
                }}
              />
              {searchOpen && query.trim() && (
                <div className="search-results" role="listbox">
                  {searchPages
                    .filter(
                      (item) =>
                        item.label
                          .toLowerCase()
                          .includes(query.trim().toLowerCase()) &&
                        (canSearchEmployees || item.href !== "/employees"),
                    )
                    .map((item) => (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => {
                          router.push(`${routePrefix}${item.href}`);
                          setSearchOpen(false);
                          setQuery("");
                        }}
                      >
                        {item.label}
                        <small>Page</small>
                      </button>
                    ))}
                  {employeeResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        router.push(
                          `${routePrefix}/employees?search=${encodeURIComponent(item.employeeCode)}`,
                        );
                        setSearchOpen(false);
                        setQuery("");
                      }}
                    >
                      {item.firstName} {item.lastName}
                      <small>{item.employeeCode}</small>
                    </button>
                  ))}
                  {!searchPages.some((item) =>
                    item.label
                      .toLowerCase()
                      .includes(query.trim().toLowerCase()),
                  ) &&
                    !employeeResults.length && <span>No matches</span>}
                </div>
              )}
            </div>
            <div className="topbar-date">
              {now
                ? new Intl.DateTimeFormat("en", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  }).format(now)
                : "—"}
            </div>
            {user && <NotificationCenter isAdmin={isAdmin} />}
            {user?.organizationId && <ChatLauncher isAdmin={isAdmin} />}
            {user && !user.organizationId && (
              <Link
                className="chat-top-trigger"
                href={`${routePrefix}/chat`}
                aria-label="Open inbox"
              >
                <MessageSquare size={20} />
              </Link>
            )}
          </header>
          <div className="page-content">{children}</div>
        </main>
      </div>
    </ChatProvider>
  );
}
