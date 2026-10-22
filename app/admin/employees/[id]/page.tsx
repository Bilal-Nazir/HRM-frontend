"use client";

import "@/app/employee-profile.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Clock3, Gauge, IdCard, Mail, TimerReset, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { TrendAreaChart } from "@/components/AdminCharts";
import { AttendanceSummary } from "@/components/AttendanceInsights";
import { ErrorBanner, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";
import { Employee, LeaveRequest } from "@/types";

type RangePreset = "current" | "previous" | "90days" | "custom";

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const monthRange = (offset: number) => {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const to = offset === 0 ? now : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0));
  return { from: dateKey(from), to: dateKey(to) };
};
const previousPeriod = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const previousTo = new Date(start); previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo); previousFrom.setUTCDate(previousFrom.getUTCDate() - days + 1);
  return { from: dateKey(previousFrom), to: dateKey(previousTo) };
};

export default function EmployeeProfilePage() {
  const employeeId = String(useParams().id);
  const [preset, setPreset] = useState<RangePreset>("current");
  const [range, setRange] = useState(monthRange(0));
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [previous, setPrevious] = useState<AttendanceSummary | null>(null);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const applyPreset = (value: RangePreset) => {
    setPreset(value);
    if (value === "current") setRange(monthRange(0));
    if (value === "previous") setRange(monthRange(-1));
    if (value === "90days") {
      const to = new Date(); const from = new Date(); from.setUTCDate(from.getUTCDate() - 89);
      setRange({ from: dateKey(from), to: dateKey(to) });
    }
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const prior = previousPeriod(range.from, range.to);
    try {
      const [profileResult, summaryResult, previousResult, leaveResult] = await Promise.all([
        api.get<{ employee: Employee }>(`/employee/${employeeId}`),
        api.get<AttendanceSummary>(`/attendance/summary?scope=organization&employeeId=${employeeId}&from=${range.from}&to=${range.to}`),
        api.get<AttendanceSummary>(`/attendance/summary?scope=organization&employeeId=${employeeId}&from=${prior.from}&to=${prior.to}`),
        api.get<{ leaveRequests: LeaveRequest[] }>(`/leave/requests/manage?employeeId=${employeeId}&from=${range.from}&to=${range.to}&size=100`),
      ]);
      setEmployee(profileResult.employee); setSummary(summaryResult); setPrevious(previousResult); setLeave(leaveResult.leaveRequests || []);
    } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [employeeId, range.from, range.to]);

  useEffect(() => { void load(); }, [load]);

  const completed = summary?.daily.filter((item) => item.checkOutAt) || [];
  const averageHours = completed.length ? (completed.reduce((sum, item) => sum + item.workedHours, 0) / completed.length) : 0;
  const onTime = summary?.totalWorkingDays ? Math.round(((summary.totalWorkingDays - summary.flags.lateCheckIns) / summary.totalWorkingDays) * 100) : 0;
  const approvedLeaveDays = leave.filter((item) => item.status === "approved" && item.requestKind !== "work_from_home").reduce((sum, item) => sum + item.totalDays, 0);
  const workFromHomeDays = leave.filter((item) => item.status === "approved" && item.requestKind === "work_from_home").reduce((sum, item) => sum + item.totalDays, 0);
  const hoursDelta = previous?.totalWorkedHours ? Math.round((((summary?.totalWorkedHours || 0) - previous.totalWorkedHours) / previous.totalWorkedHours) * 100) : (summary?.totalWorkedHours ? 100 : 0);
  const trend = useMemo(() => [...(summary?.daily || [])].reverse().map((item) => ({ day: item.workDate, value: item.workedHours })), [summary]);

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
    <section className="employee-report-filter card">
      <div className="filter-chips">{(["current","previous","90days","custom"] as RangePreset[]).map(value=><button key={value} type="button" className={preset===value?"active":""} onClick={()=>applyPreset(value)}>{value==="current"?"Current month":value==="previous"?"Previous month":value==="90days"?"Last 90 days":"Custom"}</button>)}</div>
      {preset === "custom" && <div className="employee-date-range"><label>From<input type="date" value={range.from} max={range.to} onChange={e=>setRange({...range,from:e.target.value})}/></label><label>To<input type="date" value={range.to} min={range.from} onChange={e=>setRange({...range,to:e.target.value})}/></label></div>}
      <span>{range.from} to {range.to}</span>
    </section>
    {loading ? <div className="loading-line"/> : summary && <>
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
      <section className="card"><div className="card-header"><div><span className="section-kicker">Detailed report</span><h2>Attendance records</h2><p>Daily sessions, hours, and exceptions</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Hours</th><th>Flags</th></tr></thead><tbody>{summary.daily.map(item=><tr key={item.id}><td>{item.workDate}</td><td>{new Date(item.checkInAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</td><td>{item.checkOutAt?new Date(item.checkOutAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):"In progress"}</td><td>{item.workedHours}h</td><td>{item.flags.length?item.flags.map(flag=>flag.replaceAll("_"," ")).join(", "):"On track"}</td></tr>)}</tbody></table>{!summary.daily.length&&<p className="panel-message">No attendance records in this period.</p>}</div></section>
    </>}
  </AppShell>;
}

function ReportStat({icon,label,value,detail,positive}:{icon:React.ReactNode;label:string;value:string|number;detail:string;positive?:boolean}) {
  return <article className="card employee-report-stat"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{positive===undefined?null:positive?<TrendingUp size={13}/>:<TrendingDown size={13}/>} {detail}</p></div></article>;
}
