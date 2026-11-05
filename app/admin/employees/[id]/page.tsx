"use client";

import "@/app/employee-profile.css";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowLeft, BriefcaseBusiness, CalendarDays, Clock3, Gauge, IdCard, ListChecks, Mail, Palmtree, TimerReset, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { TrendAreaChart } from "@/components/AdminCharts";
import { AttendanceSummary } from "@/components/AttendanceInsights";
import AttendanceDayRecords from "@/components/AttendanceDayRecords";
import { attendanceTrend, groupAttendanceDays } from "@/lib/attendanceReport";
import { ErrorBanner, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";
import { Employee, LeaveRequest } from "@/types";
import EmployeeWorkReport, { EmployeeWorkData } from "@/components/EmployeeWorkReport";

type RangePreset = "current" | "previous" | "90days" | "custom";
type ReportTab = "attendance" | "tasks" | "requests" | "activities";
const reportTabs = [
  { id: "attendance", label: "Attendance", icon: CalendarDays },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "requests", label: "Requests", icon: Palmtree },
  { id: "activities", label: "Activities", icon: Activity },
] as const;

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthRange = (offset: number) => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = offset === 0 ? now : new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: dateKey(from), to: dateKey(to) };
};
const previousPeriod = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const previousTo = new Date(start); previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo); previousFrom.setUTCDate(previousFrom.getUTCDate() - days + 1);
  return { from: previousFrom.toISOString().slice(0, 10), to: previousTo.toISOString().slice(0, 10) };
};

export default function EmployeeProfilePage() {
  return <Suspense fallback={<AppShell><div className="loading-line"/></AppShell>}><EmployeeProfileReport/></Suspense>;
}

function EmployeeProfileReport() {
  const employeeId = String(useParams().id);
  const params = useSearchParams(), router = useRouter(), pathname = usePathname();
  const requestedPreset = params.get("period");
  const preset = (["current", "previous", "90days", "custom"].includes(requestedPreset || "") ? requestedPreset : "current") as RangePreset;
  const tab = (reportTabs.some((item) => item.id === params.get("tab")) ? params.get("tab") : "attendance") as ReportTab;
  const fromParam = params.get("from"), toParam = params.get("to");
  const range = useMemo(() => {
    if (preset === "custom" && fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam) && fromParam <= toParam) return { from: fromParam, to: toParam };
    if (preset === "previous") return monthRange(-1);
    if (preset === "90days") { const from = new Date(); from.setDate(from.getDate() - 89); return { from: dateKey(from), to: dateKey(new Date()) }; }
    return monthRange(0);
  }, [preset, fromParam, toParam]);
  const updateQuery = (updates: Record<string, string>, push = false) => {
    const query = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => value ? query.set(key, value) : query.delete(key));
    const target = `${pathname}?${query.toString()}`;
    if (push) router.push(target, { scroll: false }); else router.replace(target, { scroll: false });
  };
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [previous, setPrevious] = useState<AttendanceSummary | null>(null);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workData, setWorkData] = useState<EmployeeWorkData | null>(null);
  const [workLoading, setWorkLoading] = useState(true);
  const [workError, setWorkError] = useState("");
  const loadVersion = useRef(0);

  const applyPreset = (value: RangePreset) => {
    updateQuery({ period: value, from: value === "custom" ? range.from : "", to: value === "custom" ? range.to : "" });
  };

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true); setError("");
    const prior = previousPeriod(range.from, range.to);
    try {
      const [profileResult, summaryResult, previousResult, leaveResult] = await Promise.all([
        api.get<{ employee: Employee }>(`/employee/${employeeId}`),
        api.get<AttendanceSummary>(`/attendance/summary?scope=organization&employeeId=${employeeId}&from=${range.from}&to=${range.to}`),
        api.get<AttendanceSummary>(`/attendance/summary?scope=organization&employeeId=${employeeId}&from=${prior.from}&to=${prior.to}`),
        api.get<{ leaveRequests: LeaveRequest[] }>(`/leave/requests/manage?employeeId=${employeeId}&from=${range.from}&to=${range.to}&size=100`),
      ]);
      if (version === loadVersion.current) { setEmployee(profileResult.employee); setSummary(summaryResult); setPrevious(previousResult); setLeave(leaveResult.leaveRequests || []); }
    } catch (err) { if (version === loadVersion.current) setError(errorMessage(err)); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [employeeId, range.from, range.to]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let cancelled = false;
    setWorkLoading(true); setWorkError("");
    api.get<EmployeeWorkData>(`/attendance/employee-activity?employeeId=${employeeId}&from=${range.from}&to=${range.to}`).then((data) => { if (!cancelled) setWorkData(data); }).catch((err) => { if (!cancelled) setWorkError(errorMessage(err)); }).finally(() => { if (!cancelled) setWorkLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId, range.from, range.to]);

  const completed = summary?.daily.filter((item) => item.checkOutAt) || [];
  const attendanceDays = useMemo(() => groupAttendanceDays(summary?.daily || []), [summary]);
  const averageHours = attendanceDays.length ? (summary?.totalWorkedHours || 0) / attendanceDays.length : 0;
  const lateDays = attendanceDays.filter((day) => day.flags.includes("late_check_in")).length;
  const onTime = attendanceDays.length ? Math.round(((attendanceDays.length - lateDays) / attendanceDays.length) * 100) : 0;
  const approvedLeaveDays = leave.filter((item) => item.status === "approved" && item.requestKind !== "work_from_home").reduce((sum, item) => sum + item.totalDays, 0);
  const workFromHomeDays = leave.filter((item) => item.status === "approved" && item.requestKind === "work_from_home").reduce((sum, item) => sum + item.totalDays, 0);
  const hoursDelta = previous?.totalWorkedHours ? Math.round((((summary?.totalWorkedHours || 0) - previous.totalWorkedHours) / previous.totalWorkedHours) * 100) : (summary?.totalWorkedHours ? 100 : 0);
  const trend = useMemo(() => attendanceTrend(summary?.daily || [], range.from, range.to), [summary, range.from, range.to]);

  return <AppShell>
    <section className="employee-profile-hero">
      <div className="employee-profile-hero-glow" />
      <div className="employee-profile-hero-main">
        <Link href="/admin/employees" className="employee-profile-back" aria-label="Back to employees"><ArrowLeft size={18}/></Link>
        <div className="employee-profile-avatar">{employee ? `${employee.firstName[0]}${employee.lastName[0]}` : "—"}</div>
        <div className="employee-profile-identity">
          <span className="section-kicker">Employee performance</span>
          <div className="employee-profile-title"><h1>{employee ? `${employee.firstName} ${employee.lastName}` : "Employee profile"}</h1>{employee && <StatusPill value={employee.employmentStatus}/>}</div>
          <p>Individual attendance, work progress, leave, and performance overview.</p>
          <div className="employee-profile-meta">
            <span><IdCard size={15}/>{employee?.employeeCode || "Loading…"}</span>
            <span><BriefcaseBusiness size={15}/>{employee?.jobTitle || "Employee"}</span>
            <span><Mail size={15}/>{employee?.workEmail || "Loading…"}</span>
          </div>
        </div>
      </div>
      <div className="employee-profile-period">
        <span>Report period</span>
        <strong>{range.from}</strong>
        <i>to</i>
        <strong>{range.to}</strong>
        <small style={{textTransform:"capitalize"}}>{employee?.employmentType?.replace("-", " ") || "—"}</small>
      </div>
    </section>
    {error && <ErrorBanner message={error} />}
    <section className="employee-report-toolbar card" aria-label="Employee report navigation and filters">
      <nav className="employee-report-tabs" aria-label="Employee report sections">{reportTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => updateQuery({ tab: id }, true)}><Icon size={16}/>{label}</button>)}</nav>
      <div className="employee-report-controls">
        <div className="filter-chips" role="group" aria-label="Report period">{(["current","previous","90days","custom"] as RangePreset[]).map(value=><button key={value} type="button" aria-pressed={preset===value} className={preset===value?"active":""} onClick={()=>applyPreset(value)}>{value==="current"?"Current month":value==="previous"?"Previous month":value==="90days"?"Last 90 days":"Custom"}</button>)}</div>
        {preset !== "custom" && <span className="employee-toolbar-period" title={`${range.from} to ${range.to}`}><CalendarDays size={14}/><span>{range.from}<span className="employee-toolbar-date-separator"> – </span>{range.to}</span></span>}
      </div>
      {preset === "custom" && <div className="employee-toolbar-custom employee-date-range"><label>From<input type="date" value={range.from} max={range.to} onChange={e=>{ if (e.target.value) updateQuery({ from: e.target.value, to: range.to }); }}/></label><label>To<input type="date" value={range.to} min={range.from} onChange={e=>{ if (e.target.value) updateQuery({ from: range.from, to: e.target.value }); }}/></label></div>}
    </section>
    {tab === "attendance" && (loading ? <div className="loading-line"/> : summary && <>
      <section className="employee-report-stats">
        <ReportStat icon={<Clock3/>} label="Hours worked" value={`${summary.totalWorkedHours}h`} detail={`${hoursDelta>=0?"+":""}${hoursDelta}% vs previous period`} positive={hoursDelta>=0}/>
        <ReportStat icon={<CalendarDays/>} label="Days present" value={summary.totalWorkingDays} detail={`${approvedLeaveDays} approved leave days`}/>
        <ReportStat icon={<TimerReset/>} label="Average day" value={`${averageHours.toFixed(1)}h`} detail={`${completed.length} completed sessions`}/>
        <ReportStat icon={<Gauge/>} label="On-time rate" value={`${onTime}%`} detail={`${summary.flags.lateCheckIns} late check-ins`}/>
        <ReportStat icon={<CalendarDays/>} label="Work from home" value={workFromHomeDays} detail="Approved days in this period"/>
      </section>
      <div className="employee-report-grid">
        <section className="card"><div className="card-header"><div><span className="section-kicker">Selected period</span><h2>Working-hours progress</h2><p>Daily completed hours across the selected range</p></div></div><TrendAreaChart data={trend} label="Hours worked" suffix="h"/></section>
        <section className="card employee-profile-card"><div className="avatar">{employee?.firstName[0]}{employee?.lastName[0]}</div><h2>{employee?.firstName} {employee?.lastName}</h2><p>{employee?.workEmail}</p><StatusPill value={employee?.employmentStatus || "active"}/><dl><div><dt>Employee ID</dt><dd>{employee?.employeeCode}</dd></div><div><dt>Employment</dt><dd>{employee?.employmentType || "—"}</dd></div><div><dt>Job title</dt><dd>{employee?.jobTitle || "—"}</dd></div></dl></section>
      </div>
      <section className="card"><div className="card-header"><div><span className="section-kicker">Detailed report</span><h2>Attendance records</h2><p>Daily totals with every session and its recorded check-in/check-out coordinates</p></div></div><AttendanceDayRecords sessions={summary.daily}/></section>
    </>)}
    {tab !== "attendance" && <>{workError && <ErrorBanner message={workError}/>} {workLoading ? <div className="loading-line"/> : !workError && workData && <EmployeeWorkReport data={workData} tab={tab}/>}</>}
  </AppShell>;
}

function ReportStat({icon,label,value,detail,positive}:{icon:React.ReactNode;label:string;value:string|number;detail:string;positive?:boolean}) {
  return <article className="card employee-report-stat"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{positive===undefined?null:positive?<TrendingUp size={13}/>:<TrendingDown size={13}/>} {detail}</p></div></article>;
}
