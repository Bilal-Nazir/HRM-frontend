"use client";
import "@/app/employee-theme.css";
import AppShell from "@/components/AppShell";
import EmployeeDashboard from "@/components/EmployeeDashboard";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import AdminAttendance, {
  AttendanceOverview,
} from "@/components/AdminAttendance";
import { AttendanceInsights, AttendanceSummary } from "@/components/AttendanceInsights";
import { EmptyState, ErrorBanner, StatCard, StatusPill } from "@/components/ui";
import { Employee } from "@/types";
import { useLiveData } from "@/lib/useLiveData";
import {
  Clock3,
  Palmtree,
  ShieldCheck,
  UserPlus,
  Users,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardPage() {
  const pathname = usePathname();
  return pathname.startsWith("/admin") ? (
    <AdminDashboard />
  ) : (
    <EmployeeDashboard />
  );
}
function AdminDashboard() {
  const insights = useLiveData<AttendanceSummary>("/attendance/summary?scope=organization");
  const people = useLiveData<{ employees: Employee[] }>(
    "/employee/view?size=5",
  );
  const attendance = useLiveData<AttendanceOverview>(
    "/attendance/manage?open=true&size=1",
  );
  const leave = useLiveData<{ totalCount: number }>(
    "/leave/requests/manage?status=pending&size=1",
  );
  const summary = attendance.error ? null : attendance.data?.summary;
  const pending = leave.error ? null : leave.data?.totalCount;
  return (
    <AppShell>
      <section className="admin-welcome">
        <div>
          <span className="eyebrow">Administration center</span>
          <h1>Your organization, clearly managed.</h1>
          <p>People, attendance, and approvals in one place.</p>
        </div>
        <div className="admin-welcome-actions">
          <Link href="/admin/employees" className="button button-primary">
            <UserPlus size={17} />
            Add employee
          </Link>
          <Link href="/admin/leave" className="button button-secondary">
            Review leave
          </Link>
        </div>
      </section>
      {(attendance.error || leave.error) && (
        <ErrorBanner message="Some live figures could not be refreshed. Open Attendance or Leave to retry." />
      )}
      <section className="stats-grid admin-stats">
        <StatCard
          label="Active workforce"
          href="/admin/employees"
          value={summary?.activeEmployees ?? "—"}
          note="Across your organization"
          icon={<Users size={19} />}
        />
        <StatCard
          label="Present now"
          href="/admin/attendance?open=true"
          value={summary?.presentNow ?? "—"}
          note="All open attendance sessions"
          icon={<Clock3 size={19} />}
        />
        <StatCard
          label="Pending approvals"
          href="/admin/leave?status=pending"
          value={pending ?? "—"}
          note="Leave and remote-work requests"
          icon={<Palmtree size={19} />}
        />
        <StatCard
          label="Attendance flags"
          href="/admin/attendance?flags=true"
          value={insights.data ? insights.data.flags.lateCheckIns + insights.data.flags.earlyCheckOuts + insights.data.flags.outsideOfficeArea : summary?.attendanceFlags ?? "—"}
          note="Late, early, or outside-office sessions"
          icon={<ShieldCheck size={19} />}
        />
      </section>
      <AttendanceInsights summary={insights.data} />
      {pending !== null && pending !== undefined && pending > 0 && (
        <div className="leave-admin-alert" role="status">
          <Bell size={22} />
          <div>
            <strong>
              {pending} employee request{pending === 1 ? "" : "s"} awaiting review
            </strong>
            <p>
              Employees have requested leave or remote work. Review their dates and reasons.
            </p>
          </div>
          <Link href="/admin/leave" className="button button-primary">
            Review requests
          </Link>
        </div>
      )}
      <AdminAttendance />
      <div style={{ marginTop: 24 }}>
        <AnnouncementsPanel admin />
      </div>
      <section className="card admin-people-card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <span className="section-kicker">People directory</span>
            <h2>Recently added employees</h2>
            <p>Account and employment status at a glance</p>
          </div>
          <Link href="/admin/employees" className="button button-secondary">
            Manage employees
          </Link>
        </div>
        {people.error ? (
          <ErrorBanner message={people.error} />
        ) : !people.data ? (
          <p className="panel-message">Loading employees…</p>
        ) : people.data.employees.length ? (
          <div className="admin-people-list">
            {people.data.employees.slice(0, 4).map((employee) => (
              <div key={employee.id} className="admin-person">
                <div className="avatar">
                  {employee.firstName?.[0]}
                  {employee.lastName?.[0]}
                </div>
                <div>
                  <strong>
                    {employee.firstName} {employee.lastName}
                  </strong>
                  <span>
                    {employee.employeeCode} · {employee.jobTitle || "Employee"}
                  </span>
                </div>
                <StatusPill value={employee.employmentStatus} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Build your team"
            description="Create your first employee account and assign an initial login password."
          />
        )}
      </section>
    </AppShell>
  );
}
