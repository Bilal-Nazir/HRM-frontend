"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Users,
  Clock3,
  Palmtree,
  ShieldAlert,
  UserPlus,
  Download,
  Search,
  Check,
  XCircle,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import { ErrorBanner, PageHeader, StatusPill } from "@/components/ui";
import {
  DepartmentBars,
  AttendanceHeatmap,
  HealthDonut,
  StatusDonut,
  TopEmployeesList,
  TrendAreaChart,
  TrendStatCard,
} from "@/components/AdminCharts";
import { useLiveData } from "@/lib/useLiveData";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";
import { AttendanceSummary } from "@/components/AttendanceInsights";
import { AttendanceOverview } from "@/components/AdminAttendance";
import { Department, Employee, LeaveRequest } from "@/types";
import DashboardEngagement from "@/components/DashboardEngagement";
import {
  attendanceHealth,
  attendanceStatusToday,
  dateKey,
  daysAgo,
  departmentName,
  flaggedCountTrend,
  formatDuration,
  headcountTrend,
  heatmapGrid,
  hoursByDepartment,
  lastNDays,
  periodDelta,
  presentCountTrend,
  recentLeaveRequests,
  topEmployees,
} from "@/lib/adminInsights";

type LeaveOverview = { leaveRequests: LeaveRequest[]; totalCount: number; lastPage: number };

function toCsv(rows: Record<string, string | number>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
}

export default function AdminHome() {
  const [greeting, setGreeting] = useState("Welcome back");
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);
  const fromKey = useMemo(() => {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 55);
    return dateKey(from);
  }, [today]);
  const trendDays = useMemo(() => lastNDays(30, today), [today]);
  const deltaDays = useMemo(() => lastNDays(14, today), [today]);

  const employeesData = useLiveData<{ employees: Employee[] }>("/employee/view?size=100");
  const adminProfile = useLiveData<{ employee: Employee }>("/employee/me");
  const departmentsData = useLiveData<{ departments: Department[] }>("/organization/departments");
  const summaryData = useLiveData<AttendanceSummary>(`/attendance/summary?scope=organization&from=${fromKey}&to=${todayKey}`);
  const liveSessions = useLiveData<AttendanceOverview>("/attendance/manage?open=true&size=10");
  const pendingLeave = useLiveData<LeaveOverview>("/leave/requests/manage?status=pending&size=6");
  const recentLeave = useLiveData<LeaveOverview>("/leave/requests/manage?size=100");

  const [deptFilter, setDeptFilter] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
    };
    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const employees = employeesData.data?.employees || [];
  const departments = departmentsData.data?.departments || [];
  const activeEmployees = employees.filter((employee) => employee.employmentStatus === "active");
  const daily = summaryData.data?.daily || [];

  const headcount = useMemo(() => headcountTrend(employees, deltaDays), [employees, deltaDays]);
  const presentTrendData = useMemo(() => presentCountTrend(daily, deltaDays), [daily, deltaDays]);
  const trend30 = useMemo(() => presentCountTrend(daily, trendDays).map((point, index) => ({
    day: point.day,
    value: activeEmployees.length ? Math.round((point.value / activeEmployees.length) * 1000) / 10 : 0,
  })), [daily, trendDays, activeEmployees.length]);
  const flaggedTrendData = useMemo(() => flaggedCountTrend(daily, deltaDays), [daily, deltaDays]);
  const pendingTrendData = useMemo(() => {
    const items = recentLeave.data?.leaveRequests || [];
    const counts = new Map(deltaDays.map((day) => [day, 0]));
    for (const item of items) {
      const key = (item.createdAt || item.startDate)?.slice(0, 10);
      if (key && counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return deltaDays.map((day) => ({ day, value: counts.get(day) || 0 }));
  }, [recentLeave.data, deltaDays]);

  const presentToday = presentTrendData[presentTrendData.length - 1]?.value ?? 0;
  const flaggedToday = flaggedTrendData[flaggedTrendData.length - 1]?.value ?? 0;
  const pendingCount = pendingLeave.data?.totalCount ?? 0;

  const workFromHomeToday = useMemo(
    () =>
      new Set(
        (recentLeave.data?.leaveRequests || [])
          .filter(
            (request) =>
              request.requestKind === "work_from_home" &&
              request.status === "approved" &&
              request.startDate.slice(0, 10) <= todayKey &&
              request.endDate.slice(0, 10) >= todayKey,
          )
          .map((request) => request.employeeId),
      ),
    [recentLeave.data, todayKey],
  );
  const statusSegments = useMemo(
    () => attendanceStatusToday(daily, activeEmployees.length, todayKey, workFromHomeToday),
    [daily, activeEmployees.length, todayKey, workFromHomeToday],
  );
  const health = useMemo(() => (summaryData.data ? attendanceHealth(summaryData.data) : null), [summaryData.data]);
  const deptHours = useMemo(() => hoursByDepartment(daily, employees, departments), [daily, employees, departments]);
  const leaders = useMemo(() => topEmployees(daily, employees), [daily, employees]);
  const heat = useMemo(() => heatmapGrid(daily, 8), [daily]);
  const maxHeatCount = Math.max(1, ...heat.grid.flat().map((cell) => cell.count));

  const liveRows = (liveSessions.data?.attendances || []).filter((item) => {
    const matchesSearch = !tableSearch.trim() || (item.employee?.name || "").toLowerCase().includes(tableSearch.trim().toLowerCase());
    const employee = employees.find((candidate) => candidate.id === item.employeeId);
    const matchesDept = deptFilter === "all" || employee?.departmentId === deptFilter;
    return matchesSearch && matchesDept;
  });

  const queue = recentLeaveRequests(pendingLeave.data?.leaveRequests || [], 5);

  const review = async (id: string, decision: "approved" | "rejected") => {
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    setActionError("");
    try {
      await api.patch(`/leave/requests/${id}/review`, { status: decision });
      pendingLeave.refresh();
      recentLeave.refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      locked.current = false;
      setSaving(false);
    }
  };

  const exportTable = () => {
    const rows = liveRows.map((item) => ({
      Employee: item.employee?.name || "Employee unavailable",
      Department: departmentName(employees.find((candidate) => candidate.id === item.employeeId), departments),
      "Check in": new Date(item.checkInAt).toLocaleString(),
      "Check out": item.checkOutAt ? new Date(item.checkOutAt).toLocaleString() : "In progress",
      Hours: formatDuration(item.checkInAt, item.checkOutAt, today),
      Status: item.status,
      Flags: item.flags?.join("; ") || "",
    }));
    const csv = toCsv(rows);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `live-attendance-${todayKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const anyError = employeesData.error || departmentsData.error || summaryData.error || liveSessions.error;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Administration center"
        title={`${greeting}, ${adminProfile.data?.employee.firstName || "Admin"}`}
        description="Track employee attendance, approvals, and activity at a glance."
        action={
          <>
            <button className="button button-secondary" onClick={exportTable} disabled={!liveRows.length}>
              <Download size={16} />
              Export live view
            </button>
            <Link href="/admin/employees" className="button button-primary">
              <UserPlus size={17} />
              Add employee
            </Link>
          </>
        }
      />
      <DashboardEngagement audience="admin" />
      {anyError && <ErrorBanner message="Some figures could not be refreshed. Reload to try again." />}

      <section className="stats-grid admin-trend-stats">
        <TrendStatCard
          icon={<Users size={16} />}
          iconClass="mini-icon-green"
          label="Total employees"
          value={activeEmployees.length}
          note={`${employees.length} total accounts`}
          trend={headcount}
          delta={periodDelta(headcount.map((point) => point.value))}
          color="var(--primary)"
        />
        <TrendStatCard
          icon={<Clock3 size={16} />}
          iconClass="mini-icon-green"
          label="Present today"
          value={presentToday}
          note={activeEmployees.length ? `${Math.round((presentToday / activeEmployees.length) * 100)}% of total employees` : "No active employees yet"}
          trend={presentTrendData}
          delta={periodDelta(presentTrendData.map((point) => point.value))}
          color="var(--info)"
        />
        <TrendStatCard
          icon={<Palmtree size={16} />}
          iconClass="mini-icon-amber"
          label="Pending approvals"
          value={pendingCount}
          note="Leave & remote-work requests"
          trend={pendingTrendData}
          delta={periodDelta(pendingTrendData.map((point) => point.value))}
          color="var(--warning)"
        />
        <TrendStatCard
          icon={<ShieldAlert size={16} />}
          iconClass="mini-icon-red"
          label="Attendance issues"
          value={flaggedToday}
          note="Late, early, or outside-office today"
          trend={flaggedTrendData}
          delta={periodDelta(flaggedTrendData.map((point) => point.value))}
          color="#d9695f"
        />
      </section>

      <div className="admin-report-grid admin-report-grid-top">
        <section className="card">
          <div className="card-header">
            <div><span className="section-kicker">Last 30 days</span><h2>Attendance trend</h2><p>Share of active employees present each day</p></div>
          </div>
          {trend30.some((point) => point.value > 0) ? <TrendAreaChart data={trend30} label="Present" suffix="%" /> : <p className="panel-message">Not enough attendance history yet to chart a trend.</p>}
        </section>
        <section className="card">
          <div className="card-header"><div><span className="section-kicker">Today</span><h2>Attendance status</h2><p>How your active workforce checked in today</p></div></div>
          <div className="card-body"><StatusDonut segments={statusSegments} centerLabel="Employees" centerValue={activeEmployees.length} /></div>
        </section>
      </div>

      <div className="admin-report-grid admin-report-grid-mid">
        <section className="card">
          <div className="card-header"><div><span className="section-kicker">Last 56 days</span><h2>Attendance health</h2><p>Composite score from on-time, full-day, and clean sessions</p></div></div>
          <div className="card-body">{health ? <HealthDonut overall={health.overall} metrics={health.metrics} /> : <p className="panel-message">Loading…</p>}</div>
        </section>
        <section className="card">
          <div className="card-header"><div><span className="section-kicker">Last 8 weeks</span><h2>Attendance heatmap</h2><p>Check-in activity across all employees</p></div></div>
          <div className="card-body"><AttendanceHeatmap grid={heat.grid} weekLabels={heat.weekLabels} maxCount={maxHeatCount} /></div>
        </section>
        <section className="card">
          <div className="card-header"><div><span className="section-kicker">Last 56 days</span><h2>Top employees</h2><p>Most active by working hours</p></div></div>
          <div className="card-body"><TopEmployeesList items={leaders} /></div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div><span className="section-kicker">This period</span><h2>Hours worked by department</h2><p>Total completed working hours, last 56 days</p></div></div>
        <div className="card-body"><DepartmentBars data={deptHours} /></div>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div><span className="section-kicker">Live</span><h2>Live employee reports</h2><p>Currently checked-in employees, updated every 30 seconds</p></div>
          <div className="admin-table-actions">
            <div className="field" style={{ position: "relative", width: 220 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "#819088" }} />
              <input style={{ paddingLeft: 32, minHeight: 36 }} placeholder="Search employees…" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} />
            </div>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Department filter">
              <option value="all">All departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </div>
        </div>
        {liveSessions.error && <ErrorBanner message={`Could not load live sessions: ${liveSessions.error}`} />}
        {!liveSessions.data && !liveSessions.error && <p className="panel-message">Loading live sessions…</p>}
        {liveSessions.data && !liveRows.length && <div className="empty-state"><div className="empty-orbit" /><h3>Nobody matches those filters</h3><p>Adjust the search or department filter above.</p></div>}
        {liveRows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Department</th><th>Check in</th><th>Check out</th><th>Hours</th><th>Status</th><th>Flags</th></tr></thead>
              <tbody>
                {liveRows.map((item) => {
                  const employee = employees.find((candidate) => candidate.id === item.employeeId);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="person-cell">
                          <div className="avatar">{(item.employee?.name || "").trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "--"}</div>
                          <div><strong>{item.employee?.name || "Employee unavailable"}</strong><span>{item.employee?.employeeCode}</span></div>
                        </div>
                      </td>
                      <td>{departmentName(employee, departments)}</td>
                      <td>{new Date(item.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{item.checkOutAt ? new Date(item.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "In progress"}</td>
                      <td>{formatDuration(item.checkInAt, item.checkOutAt, today)}</td>
                      <td><StatusPill value={item.status} /></td>
                      <td>{item.flags?.length ? <span className="attendance-flags">{item.flags.join(", ").replaceAll("_", " ")}</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="admin-report-grid admin-report-grid-bottom">
        <section className="card">
          <div className="card-header">
            <div><span className="section-kicker">Approvals</span><h2>Recent requests</h2><p>Latest leave and remote-work submissions</p></div>
            <Link href="/admin/leave" className="button button-secondary">View all</Link>
          </div>
          {actionError && <ErrorBanner message={actionError} />}
          {!pendingLeave.data && !pendingLeave.error && <p className="panel-message">Loading requests…</p>}
          {pendingLeave.data && !queue.length && <div className="empty-state"><div className="empty-orbit" /><h3>All caught up</h3><p>No pending requests right now.</p></div>}
          {queue.length > 0 && (
            <ul className="recent-requests-list">
              {queue.map((item) => (
                <li key={item.id}>
                  <div className="person-cell">
                    <div className="avatar">{(item.employee?.name || "").trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "--"}</div>
                    <div><strong>{item.employee?.name || "Employee"}</strong><span>{item.requestKind === "work_from_home" ? "Remote work request" : item.leaveTypeName || "Leave request"} · {item.totalDays}d</span></div>
                  </div>
                  <span className="recent-requests-date">{daysAgo(item.createdAt || item.startDate)}</span>
                  <div className="admin-table-actions">
                    <button className="button button-secondary" disabled={saving} onClick={() => void review(item.id, "approved")}><Check size={14} />Approve</button>
                    <button className="button button-secondary" disabled={saving} onClick={() => void review(item.id, "rejected")}><XCircle size={14} />Reject</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <AnnouncementsPanel admin />
      </div>
    </AppShell>
  );
}
