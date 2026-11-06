"use client";

import { ArrowLeft, AtSign, Check, Clock3, Copy, FileUp, Paperclip, Pencil, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { ErrorBanner } from "@/components/ui";
import TaskActivity, { taskDateTime, taskDuration, TaskPersonLink } from "@/components/TaskActivity";
import { api, ApiError } from "@/lib/api";
import { taskDetailsHref, TaskActivityTab } from "@/lib/taskLinks";
import { useClientClock } from "@/lib/useClientClock";
import { ProjectMember } from "@/types";
import { TaskDetailData, TaskMembers, TaskPerson } from "@/types/taskDetails";

const activityTabs: { id: TaskActivityTab; label: string }[] = [{ id: "all", label: "All" }, { id: "comments", label: "Comments" }, { id: "history", label: "History" }, { id: "worklog", label: "Work log" }];
const localDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
type Draft = { title: string; description: string; priority: string; labels: string; startDate: string; dueDate: string; estimatedHours: string; assigneeEmployeeIds: string[] };

export default function TaskDetails() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const pathname = usePathname(), params = useSearchParams(), router = useRouter();
  const admin = pathname.startsWith("/admin"), prefix = admin ? "/admin" : "";
  const now = useClientClock();
  const [data, setData] = useState<TaskDetailData | null>(null), [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null), [comment, setComment] = useState(""), [mentioned, setMentioned] = useState<string[]>([]), [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; pdf: boolean } | null>(null);
  const [paging, setPaging] = useState(false);
  const endpoint = `/projects/${projectId}/tasks/${taskId}`;
  const activeEndpoint = useRef(endpoint);
  activeEndpoint.current = endpoint;
  const backQuery = new URLSearchParams();
  const source = params.get("from");
  if (source) {
    const [sourcePath, sourceQuery] = source.split("?");
    if ([`/projects/${projectId}`, `/projects/${projectId}/board`, `/admin/projects/${projectId}`, `/admin/projects/${projectId}/board`].includes(sourcePath)) {
      const filters = new URLSearchParams(sourceQuery);
      if (["overview", "board", "tasks", "calendar", "members", "workflow", "activity", "trash"].includes(filters.get("view") || "")) backQuery.set("view", filters.get("view")!);
      if (/^[a-f0-9]{24}$/i.test(filters.get("assignee") || "")) backQuery.set("assignee", filters.get("assignee")!);
    }
  }
  const backHref = `${prefix}/projects/${projectId}/board${backQuery.size ? `?${backQuery}` : ""}`;
  const requestedTab = params.get("activity");
  const tab: TaskActivityTab = activityTabs.some((item) => item.id === requestedTab) ? requestedTab as TaskActivityTab : "all";
  const refresh = useCallback(async () => {
    const next = await api.get<TaskDetailData>(endpoint);
    if (activeEndpoint.current !== endpoint) return;
    setData((current) => current?.task.id === next.task.id ? {
      ...next,
      activity: [...next.activity, ...current.activity.filter((row) => !next.activity.some((entry) => entry.id === row.id))],
      worklog: [...next.worklog, ...current.worklog.filter((row) => !next.worklog.some((entry) => entry.id === row.id))],
      activityPagination: current.activityPagination.page > 1 ? { ...current.activityPagination, totalCount: next.activityPagination.totalCount } : next.activityPagination,
      worklogPagination: current.worklogPagination.page > 1 ? { ...current.worklogPagination, totalCount: next.worklogPagination.totalCount } : next.worklogPagination,
    } : next);
  }, [endpoint]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setData(null); setError(""); setDraft(null); setComment(""); setMembers([]); setMentioned([]); setMentionQuery(null); setPreview(null);
    api.get<TaskDetailData>(endpoint).then((result) => { if (!cancelled) setData(result); }).catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load task"); }).finally(() => { if (!cancelled) setLoading(false); });
    api.get<TaskMembers>(`/projects/${projectId}/members`).then((result) => { if (!cancelled) setMembers(result.members); }).catch(() => {});
    return () => { cancelled = true; };
  }, [endpoint, projectId]);

  useEffect(() => {
    if (draft || busy || loading) return;
    const timer = window.setInterval(() => { void refresh().catch(() => {}); }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh, draft, busy, loading]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => { if (!copied) return; const timeout = window.setTimeout(() => setCopied(false), 2500); return () => window.clearTimeout(timeout); }, [copied]);

  const act = async (operation: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await operation(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update task"); }
    finally { setBusy(false); }
  };
  const beginEdit = () => {
    if (!data) return;
    const task = data.task;
    setDraft({ title: task.title, description: task.description || "", priority: task.priority, labels: task.labels.join(", "), startDate: localDateTime(task.startDate), dueDate: task.dueDate?.slice(0, 10) || "", estimatedHours: String(task.estimatedHours ?? ""), assigneeEmployeeIds: [...task.assigneeEmployeeIds] });
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    void act(async () => {
      await api.patch(endpoint, { ...draft, labels: draft.labels.split(",").map((label) => label.trim()).filter(Boolean), startDate: draft.startDate ? new Date(draft.startDate).toISOString() : null, dueDate: draft.dueDate || null, estimatedHours: draft.estimatedHours === "" ? null : Number(draft.estimatedHours) });
      setDraft(null);
    });
  };
  const chooseTab = (value: TaskActivityTab) => {
    const query = new URLSearchParams(params.toString()); query.set("activity", value);
    router.replace(`${pathname}?${query}`, { scroll: false });
  };
  const loadOlder = async () => {
    if (!data) return;
    setPaging(true); setError("");
    const historyPage = data.activityPagination.page + (tab !== "worklog" && data.activityPagination.hasMore ? 1 : 0);
    const worklogPage = data.worklogPagination.page + ((tab === "all" || tab === "worklog") && data.worklogPagination.hasMore ? 1 : 0);
    try {
      const next = await api.get<TaskDetailData>(`${endpoint}?activityPage=${historyPage}&worklogPage=${worklogPage}`);
      if (activeEndpoint.current !== endpoint) return;
      setData((current) => !current ? current : { ...current, worklog: [...current.worklog, ...next.worklog.filter((row) => !current.worklog.some((entry) => entry.id === row.id))], worklogPagination: next.worklogPagination, activity: [...current.activity, ...next.activity.filter((row) => !current.activity.some((entry) => entry.id === row.id))], activityPagination: next.activityPagination });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load older activity"); }
    finally { setPaging(false); }
  };
  const insertMention = (member: ProjectMember) => {
    const input = commentInput.current;
    if (!input || !member.employee) return;
    const caret = input.selectionStart;
    const before = comment.slice(0, caret).replace(/@[\w-]*$/, `@${member.employee.employeeCode} `);
    setComment(before + comment.slice(caret)); setMentioned((ids) => [...new Set([...ids, member.employeeId])]); setMentionQuery(null);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(before.length, before.length); });
  };
  const addComment = (event: FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    void act(async () => {
      await api.post(`${endpoint}/comments`, { body: comment, mentionedEmployeeIds: mentioned.filter((id) => { const code = members.find((member) => member.employeeId === id)?.employee?.employeeCode; return code && comment.includes(`@${code}`); }) });
      setComment(""); setMentioned([]); setMentionQuery(null);
    });
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    await act(async () => {
      for (const file of Array.from(files)) {
        if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is larger than 8 MB`);
        const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read file")); reader.readAsDataURL(file); });
        await api.post(`${endpoint}/attachments`, { name: file.name, mimeType: file.type || "text/plain", data: encoded });
      }
    });
  };
  const openAttachment = async (item: TaskDetailData["attachments"][number]) => {
    try {
      const blob = await api.download(`/projects/${projectId}/attachments/${item.id}`), url = URL.createObjectURL(blob);
      if (item.mimeType.startsWith("image/") || item.mimeType === "application/pdf") setPreview({ url, name: item.originalName, pdf: item.mimeType === "application/pdf" });
      else { const link = document.createElement("a"); link.href = url; link.download = item.originalName; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open attachment"); }
  };
  const task = data?.task;
  const elapsed = task ? (task.accumulatedSeconds || 0) + (task.timeStartedAt && now ? Math.max(0, Math.floor((+now - +new Date(task.timeStartedAt)) / 1000)) : 0) : 0;
  const canEdit = !!data?.permissions.canEdit;
  const people = (persons: TaskPerson[]) => persons.length ? persons.map((person) => <div className="task-detail-person" key={person.id}><span className="avatar">{person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span><TaskPersonLink person={person} admin={admin}/></div>) : <span className="task-detail-muted">Unassigned</span>;
  const suggestions = mentionQuery === null ? [] : members.filter((member) => member.employee && `${member.employee.firstName} ${member.employee.lastName} ${member.employee.employeeCode}`.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);

  return <AppShell><div className="task-detail-page">
    <nav className="task-detail-breadcrumb" aria-label="Breadcrumb"><Link href={`${prefix}/projects`}>Projects</Link><span>/</span><Link href={backHref}>{data?.project.name || "Project"}</Link><span>/</span><span>{task?.key || "Task"}</span></nav>
    {error && <ErrorBanner message={error}/>}
    {loading && <div className="loading-line"/>}
    {!loading && !data && <section className="card card-body"><h2>Task unavailable</h2><p>The task may have been deleted or you may not have access to this project.</p><Link className="button button-secondary" href={`${prefix}/projects`}>Back to projects</Link></section>}
    {data && task && <>
      <header className="task-detail-header"><div><span className="section-kicker">{task.type} · {task.key}</span><h1>{task.title}</h1></div><div className="task-detail-actions"><Link className="button button-secondary" href={backHref}><ArrowLeft size={15}/> Back to project</Link><button className="button button-secondary" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}${taskDetailsHref(projectId, taskId, false)}`); setCopied(true); } catch { setError("Could not copy the link. Copy the page URL from your browser."); } }}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? "Copied" : "Copy link"}</button>{canEdit && !draft && <button className="button button-primary" onClick={beginEdit}><Pencil size={15}/> Edit task</button>}</div></header>
      {data.project.status === "archived" && <p className="task-detail-notice">This project is archived. Task details are read-only.</p>}
      <div className="task-detail-layout"><main className="task-detail-main">
        <section className={`card task-detail-timer${task.timeStartedAt ? " running" : ""}`}><Clock3 size={23}/><div><span>{task.timeStartedAt ? "Timer running" : task.timeStoppedAt ? "Timer paused" : "Timer not started"}</span><strong>{taskDuration(elapsed)} recorded</strong></div>{canEdit && <button className="button button-secondary" disabled={busy} onClick={() => void act(async () => { await api.patch(`${endpoint}/timer`, { action: task.timeStartedAt ? "pause" : "start" }); })}>{task.timeStartedAt ? "Pause timer" : "Start / resume"}</button>}</section>
        <section className="card task-detail-section"><h2>Description</h2>{draft ? <form className="task-detail-edit" onSubmit={save}>
          <label className="field">Title<input required maxLength={180} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}/></label>
          <label className="field">Description<textarea className="task-detail-description" rows={14} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}/></label>
          <div className="task-edit-grid"><label className="field">Priority<select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>{["low", "medium", "high", "critical"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="field">Estimated hours<input type="number" min="0" step="0.25" value={draft.estimatedHours} onChange={(e) => setDraft({ ...draft, estimatedHours: e.target.value })}/></label><label className="field">Scheduled start<input type="datetime-local" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}/></label><label className="field">Due date<input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}/></label></div>
          <label className="field">Labels<input placeholder="Separate with commas" value={draft.labels} onChange={(e) => setDraft({ ...draft, labels: e.target.value })}/></label>
          <fieldset className="task-assignee-picker"><legend>Assignees</legend>{members.filter((member) => member.role !== "viewer").map((member) => <label key={member.employeeId}><input type="checkbox" checked={draft.assigneeEmployeeIds.includes(member.employeeId)} onChange={(e) => setDraft({ ...draft, assigneeEmployeeIds: e.target.checked ? [...draft.assigneeEmployeeIds, member.employeeId] : draft.assigneeEmployeeIds.filter((id) => id !== member.employeeId) })}/>{member.employee?.firstName} {member.employee?.lastName}</label>)}</fieldset>
          <div className="task-detail-actions"><button className="button button-primary" disabled={busy}>Save changes</button><button type="button" className="button button-secondary" disabled={busy} onClick={() => setDraft(null)}>Cancel</button></div>
        </form> : <div className="task-detail-description-read">{task.description || <span className="task-detail-muted">No description provided.</span>}</div>}</section>
        {!!data.children.length && <section className="card task-detail-section"><h2>Child tasks ({data.children.length})</h2><div className="task-child-list">{data.children.map((child) => <Link key={child.id} href={taskDetailsHref(projectId, child.id, admin)}><strong>{child.key}</strong><span>{child.title}</span><small>{data.workflow.find((status) => status.id === child.workflowStatusId)?.name}</small></Link>)}</div></section>}
        <section className="card task-detail-section"><header className="task-section-heading"><h2>Files and screenshots ({data.attachments.length})</h2>{canEdit && <label className="button button-secondary task-upload"><FileUp size={15}/> Upload<input disabled={busy} type="file" multiple accept="image/*,.pdf,.txt,.csv,.zip,.docx,.xlsx" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }}/></label>}</header><div className="task-detail-files">{data.attachments.map((item) => <button key={item.id} type="button" onClick={() => void openAttachment(item)}><Paperclip size={18}/><span><strong>{item.originalName}</strong><small>{Math.ceil(item.size / 1024)} KB · {taskDateTime(item.createdAt)}</small></span></button>)}{!data.attachments.length && <p className="task-detail-empty">No files attached.</p>}</div></section>
      </main><aside className="card task-detail-sidebar"><h2>Details</h2><dl>
        <div><dt>Status</dt><dd><select aria-label="Task status" disabled={!canEdit || busy || !!draft} value={task.workflowStatusId} onChange={(e) => { const workflowStatusId = e.target.value; void act(async () => { await api.patch(`${endpoint}/status`, { workflowStatusId }); }); }}>{!data.workflow.some((status) => status.id === task.workflowStatusId) && <option value={task.workflowStatusId}>{task.status?.name || "Archived status"}</option>}{data.workflow.map((status) => <option value={status.id} key={status.id}>{status.name}</option>)}</select></dd></div>
        <div><dt>Assignees</dt><dd>{people((task.assignees || []).map((person) => ({ ...person, employeeId: person.id })))}</dd></div>
        <div><dt>Reporter</dt><dd>{people([task.reporter])}</dd></div><div><dt>Created by</dt><dd>{people([task.creator])}</dd></div>
        <div><dt>Priority</dt><dd className="task-detail-priority">{task.priority}</dd></div><div><dt>Type</dt><dd>{task.type}</dd></div>
        <div><dt>Project</dt><dd><Link className="task-person-link" href={`${prefix}/projects/${projectId}`}>{data.project.name}</Link></dd></div>
        {task.parent && <div><dt>Parent story</dt><dd>{task.parent.isDeleted ? `${task.parent.key} (deleted)` : <Link className="task-person-link" href={taskDetailsHref(projectId, task.parent.id, admin)}>{task.parent.key} · {task.parent.title}</Link>}</dd></div>}
        <div><dt>Labels</dt><dd className="task-detail-labels">{task.labels.length ? task.labels.map((label) => <span key={label}>{label}</span>) : "None"}</dd></div>
        <div><dt>Scheduled start</dt><dd>{taskDateTime(task.startDate)}</dd></div><div><dt>Due date</dt><dd>{task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "Not set"}</dd></div>
        <div><dt>Estimate</dt><dd>{task.estimatedHours === undefined || task.estimatedHours === null ? "Not set" : `${task.estimatedHours} hours`}</dd></div><div><dt>Total tracked</dt><dd>{taskDuration(elapsed)}</dd></div>
        <div><dt>Created</dt><dd>{taskDateTime(task.createdAt)}</dd></div><div><dt>Updated</dt><dd>{taskDateTime(task.updatedAt)}</dd></div>
      </dl></aside></div>
      <section className="card task-detail-section task-detail-activity" id="activity"><header className="task-section-heading"><h2>Activity</h2><button type="button" className="button button-secondary" disabled={busy} onClick={() => void act(async () => {})}><RefreshCw size={14}/> Refresh</button></header>
        <div className="task-activity-tabs" role="tablist" aria-label="Task activity">{activityTabs.map((item) => <button role="tab" type="button" aria-selected={tab === item.id} aria-controls="task-activity-panel" id={`task-tab-${item.id}`} key={item.id} onClick={() => chooseTab(item.id)}>{item.label}{item.id === "comments" && <small>{data.comments.length}</small>}</button>)}</div>
        <div id="task-activity-panel" role="tabpanel" aria-labelledby={`task-tab-${tab}`}><TaskActivity data={data} tab={tab} admin={admin} now={now}/></div>
        {((tab === "all" || tab === "history") && data.activityPagination.hasMore || (tab === "all" || tab === "worklog") && data.worklogPagination.hasMore) && <button className="button button-secondary" disabled={paging} onClick={() => void loadOlder()}>{paging ? "Loading…" : tab === "worklog" ? "Load older sessions" : "Load older activity"}</button>}
        {canEdit && (tab === "all" || tab === "comments") && <form className="task-detail-composer" onSubmit={addComment}><label htmlFor="task-comment">Add a comment</label><div className="comment-composer"><textarea id="task-comment" ref={commentInput} required rows={4} maxLength={5000} placeholder="Write a comment… Use @ to mention a teammate" value={comment} onChange={(e) => { setComment(e.target.value); const match = e.target.value.slice(0, e.target.selectionStart).match(/(?:^|\s)@([\w-]*)$/); setMentionQuery(match ? match[1] : null); }}/>{mentionQuery !== null && <div className="mention-suggestions">{suggestions.length ? suggestions.map((member) => <button type="button" key={member.employeeId} onMouseDown={(e) => e.preventDefault()} onClick={() => insertMention(member)}><span>{member.employee?.firstName} {member.employee?.lastName}<small>@{member.employee?.employeeCode}</small></span></button>) : <p>No matching project member</p>}</div>}</div><span className="comment-hint"><AtSign size={13}/> Mentioned teammates receive a notification linking to this conversation.</span><button className="button button-primary" disabled={busy || !comment.trim()}>Add comment</button></form>}
      </section>
    </>}
    {preview && <div className="modal-backdrop task-file-preview" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}><section onClick={(e) => e.stopPropagation()}><header><strong>{preview.name}</strong><button className="icon-button" aria-label="Close preview" onClick={() => setPreview(null)}><X size={20}/></button></header>{preview.pdf ? <iframe title={preview.name} src={preview.url}/> : <img alt={preview.name} src={preview.url}/>}</section></div>}
  </div></AppShell>;
}
