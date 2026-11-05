"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, ListChecks, Timer } from "lucide-react";
import { TrendAreaChart } from "@/components/AdminCharts";
import { EmptyState, StatusPill } from "@/components/ui";

type TaskLink = { id: string; key: string; title: string; projectId: string };
type Project = { id: string; name: string; key: string };
type Interval = { id: string; startedAt: string; endedAt: string; seconds: number; running: boolean; stopReason?: string };
export type EmployeeWorkData = {
  timeZone: string;
  range: { from: string; to: string };
  limitsReached: { tasks: boolean; activities: boolean; timerSessions: boolean };
  taskPeriodSummary: { seconds: number; taskCount: number; workingDays: number; sessionCount: number };
  taskDays: { date: string; taskCount: number; seconds: number; tasks: { taskId: string; seconds: number; sessionCount: number; events: string[]; intervals: Interval[]; task: TaskLink | null; project: Project | null }[] }[];
  tasks: { id: string; key: string; title: string; assigned: boolean; reported: boolean; trackedSeconds: number; status: { name: string; category: string } | null; project: Project | null }[];
  requests: { id: string; kind: string; startDate: string; endDate: string; totalDays: number; status: string; reason?: string; managerComment?: string; reviewComment?: string; createdAt: string }[];
  timeline: { id: string; type: string; at: string; title: string; detail?: string; project?: Project; task?: TaskLink }[];
};

const duration = (seconds: number) => seconds < 60 ? `${Math.max(0, Math.floor(seconds))}s` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
const taskHref = (projectId: string, taskId: string) => `/admin/projects/${projectId}/board?view=board&task=${taskId}`;
const prettyDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function EmployeeWorkReport({ data, tab }: { data: EmployeeWorkData; tab: "tasks" | "requests" | "activities" }) {
  const dateTime = (date: string) => new Date(date).toLocaleString([], { timeZone: data.timeZone, hour12: true });
  const shortTime = (date: string) => new Date(date).toLocaleTimeString([], { timeZone: data.timeZone, hour: "2-digit", minute: "2-digit", hour12: true });
  if (tab === "requests") return <section className="card employee-work-panel"><div className="card-header"><div><span className="section-kicker">Selected period</span><h2>Requests</h2><p>Requests submitted during or covering these dates, including review remarks.</p></div><span>{data.requests.length} requests</span></div>
    {data.requests.length ? <div className="employee-request-list">{data.requests.map((request) => <article key={request.id}><header><div><h3>{(request.kind || "leave").replaceAll("_", " ")}</h3><small>Submitted {dateTime(request.createdAt)}</small></div><StatusPill value={request.status}/></header><p>{new Date(request.startDate).toLocaleDateString([], { timeZone: data.timeZone })} – {new Date(request.endDate).toLocaleDateString([], { timeZone: data.timeZone })} · {request.totalDays} days</p><p>{request.reason || "No reason supplied"}</p>{request.managerComment && <blockquote><strong>Lead remarks</strong>{request.managerComment}</blockquote>}{request.reviewComment && <blockquote><strong>Final review</strong>{request.reviewComment}</blockquote>}</article>)}</div> : <EmptyState title="No requests in this period" description="Choose another month or a custom date range."/>}
  </section>;
  if (tab === "activities") {
    const days = new Map<string, EmployeeWorkData["timeline"]>();
    data.timeline.forEach((event) => { const day = new Intl.DateTimeFormat("en-CA", { timeZone: data.timeZone }).format(new Date(event.at)); days.set(day, [...(days.get(day) || []), event]); });
    return <section className="card employee-work-panel"><div className="card-header"><div><span className="section-kicker">Selected period</span><h2>Activity history</h2><p>Attendance, task changes, timers, requests, comments and mentions · {data.timeZone}</p></div></div>{[...days].map(([date, events]) => <section className="employee-activity-day" key={date}><h3>{prettyDay(date)}</h3><div className="employee-activity-timeline">{events.map((event) => <article key={event.id}><i/><div><strong>{event.title}</strong><span>{[event.detail, event.project?.name].filter(Boolean).join(" · ")}</span>{event.task && <Link href={taskHref(event.task.projectId, event.task.id)}>Open {event.task.key} <ArrowUpRight size={12}/></Link>}</div><time>{shortTime(event.at)}</time></article>)}</div></section>)}{!data.timeline.length && <EmptyState title="No activity in this period" description="Choose another month or a custom date range."/>}</section>;
  }
  const summary = data.taskPeriodSummary;
  const totals = new Map(data.taskDays.map((day) => [day.date, day.seconds]));
  const trend: { day: string; value: number }[] = [];
  const cursor = new Date(`${data.range.from}T00:00:00Z`), end = new Date(`${data.range.to}T00:00:00Z`);
  while (cursor <= end) { const day = cursor.toISOString().slice(0, 10); trend.push({ day, value: Math.round((totals.get(day) || 0) / 36) / 100 }); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return <div className="employee-task-report">
    {Object.values(data.limitsReached).some(Boolean) && <p className="employee-work-note">This report reached its record limit. Choose a shorter date range to see all sessions and events.</p>}
    <section className="employee-work-stats">{([
      [Clock3, "Time on tasks", duration(summary.seconds), "Employee timer sessions in this period"],
      [ListChecks, "Tasks worked on", summary.taskCount, "Distinct tasks with time or activity"],
      [Timer, "Timer sessions", summary.sessionCount, "Sessions overlapping the selected dates"],
      [CalendarDays, "Days with tracked time", summary.workingDays, `Report timezone: ${data.timeZone}`],
    ] as const).map(([Icon, label, value, note]) => <article className="card" key={label}><span><Icon size={19}/></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>)}</section>
    <section className="card"><div className="card-header"><div><span className="section-kicker">Selected period</span><h2>Daily task time</h2><p>Time attributed to this employee, grouped by day.</p></div></div><TrendAreaChart data={trend} label="Task time" suffix="h"/></section>
    <section className="card employee-work-panel"><div className="card-header"><div><span className="section-kicker">Daily breakdown</span><h2>Tasks by day</h2><p>Task count, time and recorded sessions for each day · {data.timeZone}</p></div></div>
      <div className="employee-task-day-list">{data.taskDays.map((day) => <section className="employee-task-day" key={day.date}><header><div><h3>{prettyDay(day.date)}</h3><small>{day.taskCount} task{day.taskCount === 1 ? "" : "s"}</small></div><strong>{duration(day.seconds)}</strong></header><div className="table-wrap"><table><thead><tr><th>Task</th><th>Project</th><th>Time this day</th><th>Sessions & activity</th></tr></thead><tbody>{day.tasks.map((row) => <tr key={row.taskId}><td>{row.task ? <Link className="employee-task-link" href={taskHref(row.task.projectId, row.task.id)}><b>{row.task.key}<ArrowUpRight size={12}/></b><span>{row.task.title}</span></Link> : <span>Deleted task</span>}</td><td>{row.project?.name || "—"}</td><td><strong>{row.sessionCount ? duration(row.seconds) : "No recorded time"}</strong></td><td>{row.intervals.length ? <details className="employee-timer-details"><summary>{row.sessionCount} session{row.sessionCount === 1 ? "" : "s"} · View history</summary>{row.intervals.map((interval) => <div key={`${interval.id}-${interval.startedAt}`}><span>{shortTime(interval.startedAt)} – {interval.running ? "Running" : shortTime(interval.endedAt)}</span><b>{duration(interval.seconds)}</b></div>)}</details> : <span className="employee-task-events">{row.events.map((event) => event.replaceAll(".", " ").replaceAll("_", " ")).join(", ") || "Activity recorded"}</span>}</td></tr>)}</tbody></table></div></section>)}{!data.taskDays.length && <EmptyState title="No task activity in this period" description="There are no employee timer sessions or task events for these dates. Related tasks are listed below."/>}</div>
    </section>
    <section className="card employee-work-panel"><div className="card-header"><div><span className="section-kicker">Task directory</span><h2>Related tasks</h2><p>Assigned, reported or worked on in this period. Historical totals belong to the whole task; the daily report above shows this employee’s time.</p></div></div><div className="table-wrap"><table><thead><tr><th>Task</th><th>Project</th><th>Status</th><th>Relation</th><th>Task total (all time)</th></tr></thead><tbody>{data.tasks.map((task) => <tr key={task.id}><td>{task.project ? <Link className="employee-task-link" href={taskHref(task.project.id, task.id)}><b>{task.key}<ArrowUpRight size={12}/></b><span>{task.title}</span></Link> : task.title}</td><td>{task.project?.name || "—"}</td><td>{task.status?.name || "—"}</td><td>{task.assigned ? "Assignee" : task.reported ? "Reporter" : "Contributor"}</td><td>{duration(task.trackedSeconds)}</td></tr>)}</tbody></table>{!data.tasks.length && <EmptyState title="No related tasks" description="Tasks assigned to or worked on by this employee will appear here."/>}</div></section>
    <p className="employee-work-note">Daily hours are available for recorded timer sessions. Older task totals cannot be allocated to specific days or employees without a session history.</p>
  </div>;
}
