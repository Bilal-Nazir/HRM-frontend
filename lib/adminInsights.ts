import { Attendance, Department, Employee, LeaveRequest } from "@/types";
import { AttendanceSummary } from "@/components/AttendanceInsights";

type DailyRecord = AttendanceSummary["daily"][number];

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function lastNDays(n: number, end = new Date()) {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(dateKey(d));
  }
  return days;
}

export function presentTrend(daily: DailyRecord[], days: string[], activeCount: number) {
  const byDay = new Map<string, Set<string>>(days.map((day) => [day, new Set<string>()]));
  for (const record of daily) byDay.get(record.workDate)?.add(record.employeeId);
  return days.map((day) => ({
    day,
    value: activeCount ? Math.round(((byDay.get(day)?.size || 0) / activeCount) * 1000) / 10 : 0,
  }));
}

export function presentCountTrend(daily: DailyRecord[], days: string[]) {
  const byDay = new Map<string, Set<string>>(days.map((day) => [day, new Set<string>()]));
  for (const record of daily) byDay.get(record.workDate)?.add(record.employeeId);
  return days.map((day) => ({ day, value: byDay.get(day)?.size || 0 }));
}

export function flaggedCountTrend(daily: DailyRecord[], days: string[]) {
  const byDay = new Map<string, Set<string>>(days.map((day) => [day, new Set<string>()]));
  for (const record of daily) if (record.flags.length) byDay.get(record.workDate)?.add(record.employeeId);
  return days.map((day) => ({ day, value: byDay.get(day)?.size || 0 }));
}

export function countTrend<T>(items: T[], days: string[], dateOf: (item: T) => string | undefined) {
  const counts = new Map(days.map((day) => [day, 0]));
  for (const item of items) {
    const key = dateOf(item)?.slice(0, 10);
    if (key && counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return days.map((day) => ({ day, value: counts.get(day) || 0 }));
}

export function headcountTrend(employees: Employee[], days: string[]) {
  return days.map((day) => ({
    day,
    value: employees.filter((employee) => {
      const joined = (employee.joinDate || employee.createdAt)?.slice(0, 10);
      return joined && joined <= day && employee.employmentStatus !== "terminated";
    }).length,
  }));
}

export function periodDelta(values: number[]) {
  if (values.length < 2) return 0;
  const mid = Math.floor(values.length / 2);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const before = avg(values.slice(0, mid));
  const after = avg(values.slice(mid));
  if (!before) return after ? 100 : 0;
  return Math.round(((after - before) / before) * 1000) / 10;
}

export function hoursByDepartment(daily: DailyRecord[], employees: Employee[], departments: Department[]) {
  const deptName = new Map(departments.map((department) => [department.id, department.name]));
  const empDept = new Map(
    employees.map((employee) => [employee.id, employee.departmentId ? deptName.get(employee.departmentId) || "Unassigned" : "Unassigned"]),
  );
  const totals = new Map<string, number>();
  for (const record of daily) {
    if (!record.checkOutAt) continue;
    const dept = empDept.get(record.employeeId) || "Unassigned";
    totals.set(dept, (totals.get(dept) || 0) + record.workedHours);
  }
  return [...totals.entries()]
    .map(([name, hours]) => ({ name, hours: Math.round(hours) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 6);
}

export function topEmployees(daily: DailyRecord[], employees: Employee[], limit = 5) {
  const totals = new Map<string, number>();
  for (const record of daily) {
    if (!record.checkOutAt) continue;
    totals.set(record.employeeId, (totals.get(record.employeeId) || 0) + record.workedHours);
  }
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  return [...totals.entries()]
    .map(([employeeId, hours]) => ({ employee: byId.get(employeeId), hours: Math.round(hours) }))
    .filter((item): item is { employee: Employee; hours: number } => !!item.employee)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, limit);
}

export function attendanceStatusToday(
  daily: DailyRecord[],
  activeEmployees: number,
  todayKey: string,
  workFromHomeEmployeeIds = new Set<string>(),
) {
  const presentEmployees = new Set<string>();
  const lateEmployees = new Set<string>();
  const earlyEmployees = new Set<string>();
  const outsideEmployees = new Set<string>();
  for (const record of daily) {
    if (record.workDate !== todayKey) continue;
    presentEmployees.add(record.employeeId);
    if (record.flags.includes("late_check_in")) lateEmployees.add(record.employeeId);
    if (record.flags.includes("early_check_out")) earlyEmployees.add(record.employeeId);
    if (record.flags.includes("outside_office_area")) outsideEmployees.add(record.employeeId);
  }
  const present = presentEmployees.size;
  const accountedFor = new Set([...presentEmployees, ...workFromHomeEmployeeIds]);
  const absent = Math.max(0, activeEmployees - accountedFor.size);
  return [
    { key: "present", label: "Present", value: present, color: "var(--primary)" },
    { key: "absent", label: "Absent", value: absent, color: "var(--danger)" },
    { key: "late", label: "Late", value: lateEmployees.size, color: "var(--warning)", chart: false },
    { key: "early", label: "Early leave", value: earlyEmployees.size, color: "var(--info)", chart: false },
    { key: "outside", label: "Outside office", value: outsideEmployees.size, color: "var(--accent)", chart: false },
    { key: "wfh", label: "Work from home", value: workFromHomeEmployeeIds.size, color: "var(--accent-2)", chart: false },
  ];
}

export function attendanceHealth(summary: AttendanceSummary) {
  const total = summary.daily.length;
  const completed = summary.daily.filter((record) => record.checkOutAt).length;
  const flagged = summary.daily.filter((record) => record.flags.length > 0).length;
  const onTime = total ? Math.round(((total - summary.flags.lateCheckIns) / total) * 100) : 0;
  const fullDays = completed ? Math.round((summary.buckets.atLeastEightHours / completed) * 100) : 0;
  const clean = total ? Math.round(((total - flagged) / total) * 100) : 0;
  const avgHours = completed ? summary.totalWorkedHours / completed : 0;
  const hoursScore = Math.min(100, Math.round((avgHours / 8) * 100));
  const overall = total ? Math.round((onTime + fullDays + clean + hoursScore) / 4) : 0;
  return {
    overall,
    metrics: [
      { label: "On-time check-ins", value: onTime, color: "var(--primary)" },
      { label: "Full work days (8h+)", value: fullDays, color: "var(--info)" },
      { label: "Sessions without flags", value: clean, color: "var(--accent)" },
      { label: "Avg hours vs 8h target", value: hoursScore, color: "var(--warning)" },
    ],
  };
}

export type HeatmapCell = { date: string; count: number; future: boolean };

export function heatmapGrid(daily: DailyRecord[], weeksCount = 8) {
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (weeksCount * 7 - 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const byDay = new Map<string, Set<string>>();
  for (const record of daily) {
    if (!byDay.has(record.workDate)) byDay.set(record.workDate, new Set());
    byDay.get(record.workDate)!.add(record.employeeId);
  }
  const grid: HeatmapCell[][] = Array.from({ length: 7 }, () => []);
  const weekLabels: string[] = [];
  const weeksNeeded = Math.ceil((today.getTime() - start.getTime()) / (7 * 86400000)) + 1;
  for (let week = 0; week < weeksNeeded; week++) {
    const weekStart = new Date(start);
    weekStart.setUTCDate(weekStart.getUTCDate() + week * 7);
    weekLabels.push(dateKey(weekStart));
    for (let weekday = 0; weekday < 7; weekday++) {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + weekday);
      const key = dateKey(date);
      grid[weekday].push({ date: key, count: byDay.get(key)?.size || 0, future: date > today });
    }
  }
  return { grid, weekLabels };
}

export function formatDuration(startIso: string, endIso: string | undefined, now: Date) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function departmentName(employee: Employee | undefined, departments: Department[]) {
  if (!employee?.departmentId) return "Unassigned";
  return departments.find((department) => department.id === employee.departmentId)?.name || "Unassigned";
}

export function recentLeaveRequests(requests: LeaveRequest[], limit = 4) {
  return [...requests]
    .sort((a, b) => (b.createdAt || b.startDate).localeCompare(a.createdAt || a.startDate))
    .slice(0, limit);
}

export function daysAgo(iso: string | undefined) {
  if (!iso) return "";
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
