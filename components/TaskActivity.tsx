"use client";

import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { TaskActivityTab } from "@/lib/taskLinks";
import { TaskDetailData, TaskHistory, TaskPerson } from "@/types/taskDetails";
import RichTextContent from "@/components/RichTextContent";

export const taskDateTime = (value?: string) => value ? new Date(value).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "Not set";
export const taskDuration = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 3600)}h ${Math.floor((Math.max(0, seconds) % 3600) / 60)}m ${Math.floor(Math.max(0, seconds) % 60)}s`;

export function TaskPersonLink({ person, admin }: { person: TaskPerson; admin: boolean }) {
  return admin && person.employeeId ? <Link className="task-person-link" href={`/admin/employees/${person.employeeId}`}>{person.name}</Link> : <span>{person.name}</span>;
}

const actionLabels: Record<string, string> = {
  "task.created": "created this task", "story.created": "created this story", "task.updated": "updated this task",
  "task.auto_paused": "automatically paused the task when its duration was reached",
  "task.auto_completed": "automatically completed the task when its duration was reached",
  "task.status_changed": "changed the status", "task.timer_started": "started the timer", "task.timer_paused": "paused the timer",
  "task.timer_auto_paused": "had the timer stopped at check-out", "attachment.added": "added an attachment",
  "comment.added": "added a comment", "task.deleted": "deleted this task", "task.restored": "restored this task",
};

export default function TaskActivity({ data, tab, admin, now }: { data: TaskDetailData; tab: TaskActivityTab; admin: boolean; now: Date | null }) {
  type Row = { id: string; at: string; person: TaskPerson; kind: "history" | "comment" | "worklog"; value: unknown };
  const rows: Row[] = [];
  if (tab === "all" || tab === "history") data.activity.filter((event) => {
    if (tab === "history") return true;
    if (event.action === "comment.added") return false;
    // Sessions already show the start, stop and duration together in All.
    if (event.action.includes("timer_") && data.worklog.some((session) => {
      const at = event.action === "task.timer_started" ? session.startedAt : session.endedAt;
      const recorded = event.action === "task.timer_started" ? event.changes?.startedAt : event.changes?.stoppedAt;
      return at && Math.abs(+new Date(at) - +new Date(String(recorded || event.createdAt))) < 1000;
    })) return false;
    return true;
  }).forEach((event) => rows.push({ id: `history-${event.id}`, at: event.createdAt, person: event.actor, kind: "history", value: event }));
  if (tab === "all" || tab === "comments") data.comments.forEach((comment) => rows.push({ id: `comment-${comment.id}`, at: comment.createdAt, person: comment.author, kind: "comment", value: comment }));
  if (tab === "all" || tab === "worklog") data.worklog.forEach((session) => rows.push({ id: `worklog-${session.id}`, at: session.startedAt, person: session.employee, kind: "worklog", value: session }));
  rows.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return <div className="task-activity-feed">
    {tab === "worklog" && <div className="task-worklog-summary"><Clock3 size={17}/><span>{data.worklogSummary.sessionCount} recorded sessions</span>{data.worklogSummary.legacySeconds > 0 && <small>{taskDuration(data.worklogSummary.legacySeconds)} was recorded before detailed sessions were available.</small>}</div>}
    {!rows.length && <p className="task-detail-empty">{tab === "comments" ? "No comments yet. Start the conversation below." : tab === "worklog" ? "No detailed timer sessions recorded yet." : "No activity recorded yet."}</p>}
    {rows.map((row) => <article key={row.id} className="task-activity-entry">
      <span className="avatar">{row.person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
      <div className="task-activity-copy">
        <div className="task-activity-heading"><strong><TaskPersonLink person={row.person} admin={admin}/></strong> {row.kind === "comment" ? "commented" : row.kind === "worklog" ? "logged time" : actionLabels[(row.value as TaskHistory).action] || (row.value as TaskHistory).action.replaceAll(".", " ").replaceAll("_", " ")}</div>
        <time dateTime={row.at} title={taskDateTime(row.at)}>{taskDateTime(row.at)}</time>
        {row.kind === "history" && (() => { const event = row.value as TaskHistory; return <>
          {event.fieldChanges.map((change) => <div key={change.field} className="task-history-change"><span>{change.label}</span><div><del>{change.field === "description" ? <RichTextContent value={change.before}/> : ["startDate", "dueDate"].includes(change.field) && change.before !== "None" ? (change.field === "dueDate" ? new Date(change.before).toLocaleDateString() : taskDateTime(change.before)) : change.before}</del><ArrowRight size={15}/><ins>{change.field === "description" ? <RichTextContent value={change.after}/> : ["startDate", "dueDate"].includes(change.field) && change.after !== "None" ? (change.field === "dueDate" ? new Date(change.after).toLocaleDateString() : taskDateTime(change.after)) : change.after}</ins></div></div>)}
          {event.action === "attachment.added" && <p>{String(event.changes?.name || "File attached")}</p>}
          {event.action === "task.timer_paused" && typeof event.changes?.durationSeconds === "number" && <p>{taskDuration(event.changes.durationSeconds)} in this session</p>}
        </>; })()}
        {row.kind === "comment" && <p className="task-comment-body">{(row.value as TaskDetailData["comments"][number]).body.split(/(@[\w-]+)/g).map((part, index) => part.startsWith("@") ? <mark className="comment-mention" key={index}>{part}</mark> : part)}</p>}
        {row.kind === "worklog" && (() => { const session = row.value as TaskDetailData["worklog"][number]; const seconds = session.endedAt || !now ? session.durationSeconds : Math.max(0, Math.floor((+now - +new Date(session.startedAt)) / 1000)); return <div className="task-worklog-session"><strong>{taskDuration(seconds)}</strong><span>{taskDateTime(session.startedAt)} → {session.endedAt ? taskDateTime(session.endedAt) : "Running"}</span><small>{!session.endedAt ? "Timer running" : session.stopReason === "auto_pause" ? "Auto paused — duration reached; admin review required" : session.stopReason === "auto_done" ? "Auto done — task duration reached" : session.stopReason === "checkout" ? "Stopped automatically at check-out" : session.stopReason === "status_change" ? "Stopped by a status change" : "Timer paused"}</small></div>; })()}
      </div>
    </article>)}
  </div>;
}
