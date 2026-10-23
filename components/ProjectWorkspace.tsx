"use client";

import {
  Activity,
  Archive,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock3,
  Columns3,
  Download,
  FileUp,
  ListChecks,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AppShell from "@/components/AppShell";
import { EmptyState, ErrorBanner, StatusPill } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { useClientClock } from "@/lib/useClientClock";
import {
  Employee,
  Project,
  ProjectActivity,
  ProjectAttachment,
  ProjectComment,
  ProjectMember,
  ProjectTask,
  WorkflowStatus,
} from "@/types";

type Tab = "overview" | "board" | "tasks" | "members" | "workflow" | "activity";
const tabs: {
  id: Tab;
  label: string;
  icon: typeof Columns3;
  admin?: boolean;
}[] = [
  { id: "overview", label: "Overview", icon: CircleDot },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "tasks", label: "Stories & tasks", icon: ListChecks },
  { id: "members", label: "Members", icon: Users },
  { id: "workflow", label: "Workflow settings", icon: Settings2, admin: true },
  { id: "activity", label: "Activity", icon: Activity },
];
const emptyTask = {
  type: "task",
  title: "",
  description: "",
  priority: "medium",
  workflowStatusId: "",
  assigneeEmployeeIds: [] as string[],
  dueDate: "",
  estimatedHours: "",
  labels: "",
};
const elapsedSeconds = (task: ProjectTask, now: Date | null) =>
  Math.max(
    0,
    (task.accumulatedSeconds || 0) +
      (task.timeStartedAt && now
        ? Math.floor(
            (now.getTime() - new Date(task.timeStartedAt).getTime()) / 1000,
          )
        : 0),
  );
const formatElapsed = (seconds: number) => {
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    secs = seconds % 60;
  return hours
    ? `${hours}h ${minutes}m`
    : `${minutes}m ${secs.toString().padStart(2, "0")}s`;
};

export default function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>(),
    pathname = usePathname(),
    admin = pathname.startsWith("/admin"),
    prefix = admin ? "/admin" : "";
  const now = useClientClock();
  const inferred = (pathname.split("/").pop() || "") as Tab;
  const [tab, setTab] = useState<Tab>(
    tabs.some((x) => x.id === inferred) ? inferred : "overview",
  );
  const [project, setProject] = useState<Project | null>(null),
    [members, setMembers] = useState<ProjectMember[]>([]),
    [workflow, setWorkflow] = useState<WorkflowStatus[]>([]),
    [tasks, setTasks] = useState<ProjectTask[]>([]),
    [activities, setActivities] = useState<ProjectActivity[]>([]),
    [employees, setEmployees] = useState<Employee[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [taskModal, setTaskModal] = useState(false),
    [memberModal, setMemberModal] = useState(false),
    [workflowModal, setWorkflowModal] = useState(false),
    [editingColumn, setEditingColumn] = useState<WorkflowStatus | null>(null),
    [selected, setSelected] = useState<ProjectTask | null>(null),
    [comments, setComments] = useState<ProjectComment[]>([]),
    [attachments, setAttachments] = useState<ProjectAttachment[]>([]),
    [pendingFiles, setPendingFiles] = useState<File[]>([]),
    [comment, setComment] = useState(""),
    [saving, setSaving] = useState(false),
    [search, setSearch] = useState(""),
    [priority, setPriority] = useState(""),
    [assignee, setAssignee] = useState(""),
    [taskForm, setTaskForm] = useState(emptyTask),
    [newMembers, setNewMembers] = useState<string[]>([]),
    [columnForm, setColumnForm] = useState({
      name: "",
      category: "todo",
      color: "#7c8b84",
      timerAction: "none" as "none" | "start" | "stop",
    });
  const moving = useRef(new Set<string>());
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detail, taskData, activityData] = await Promise.all([
        api.get<{
          project: Project;
          members: ProjectMember[];
          workflow: WorkflowStatus[];
        }>(`/projects/${projectId}`),
        api.get<{ tasks: ProjectTask[] }>(
          `/projects/${projectId}/tasks?size=200`,
        ),
        api.get<{ activity: ProjectActivity[] }>(
          `/projects/${projectId}/activity?size=100`,
        ),
      ]);
      setProject(detail.project);
      setMembers(detail.members);
      setWorkflow(detail.workflow.filter((x) => !x.isArchived));
      setTasks(taskData.tasks);
      setActivities(activityData.activity);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (admin)
      api
        .get<{ employees: Employee[] }>("/employee/view?size=100")
        .then((d) =>
          setEmployees(
            (d.employees || []).filter((x) => x.employmentStatus === "active"),
          ),
        )
        .catch(() => {});
  }, [admin]);
  const session = typeof window !== "undefined" ? getSession() : null,
    canCreateStory =
      admin ||
      members.some(
        (m) =>
          m.employeeId === session?.employeeId && m.role === "project_manager",
      );
  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!search ||
            `${t.key} ${t.title}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (!priority || t.priority === priority) &&
          (!assignee || t.assigneeEmployeeIds.includes(assignee)),
      ),
    [tasks, search, priority, assignee],
  );
  const doneIds = new Set(
      workflow.filter((x) => x.category === "done").map((x) => x.id),
    ),
    completed = tasks.filter((x) => doneIds.has(x.workflowStatusId)).length,
    overdue = tasks.filter(
      (x) =>
        x.dueDate &&
        new Date(x.dueDate) < new Date() &&
        !doneIds.has(x.workflowStatusId),
    ).length;
  const move = async (taskId: string, statusId: string) => {
    const old = tasks;
    if (
      moving.current.has(taskId) ||
      old.find((x) => x.id === taskId)?.workflowStatusId === statusId
    )
      return;
    moving.current.add(taskId);
    setTasks((rows) =>
      rows.map((x) =>
        x.id === taskId ? { ...x, workflowStatusId: statusId } : x,
      ),
    );
    try {
      const result = await api.patch<{ task: ProjectTask }>(
        `/projects/${projectId}/tasks/${taskId}/status`,
        { workflowStatusId: statusId },
      );
      setTasks((rows) =>
        rows.map((x) =>
          x.id === taskId
            ? { ...x, ...result.task, assignees: x.assignees }
            : x,
        ),
      );
    } catch (e) {
      setTasks(old);
      setError(e instanceof ApiError ? e.message : "Task move was rejected");
    } finally {
      moving.current.delete(taskId);
    }
  };
  const fileData = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  const uploadFiles = async (taskId: string, files: File[]) => {
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024)
        throw new Error(`${file.name} is larger than 8 MB`);
      await api.post(`/projects/${projectId}/tasks/${taskId}/attachments`, {
        name: file.name,
        mimeType: file.type || "text/plain",
        data: await fileData(file),
      });
    }
  };
  const createTask = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await api.post<{ task: ProjectTask }>(
        `/projects/${projectId}/tasks`,
        {
          ...taskForm,
          estimatedHours: taskForm.estimatedHours
            ? Number(taskForm.estimatedHours)
            : undefined,
          labels: taskForm.labels
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        },
      );
      if (pendingFiles.length) await uploadFiles(result.task.id, pendingFiles);
      setTaskModal(false);
      setTaskForm(emptyTask);
      setPendingFiles([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  };
  const openTask = async (task: ProjectTask) => {
    setSelected(task);
    try {
      const d = await api.get<{
        task: ProjectTask;
        comments: ProjectComment[];
        attachments: ProjectAttachment[];
      }>(`/projects/${projectId}/tasks/${task.id}`);
      setSelected({ ...task, ...d.task });
      setComments(d.comments);
      setAttachments(d.attachments || []);
    } catch {
      setComments([]);
      setAttachments([]);
    }
  };
  const attachToSelected = async (files: FileList | null) => {
    if (!selected || !files?.length) return;
    setSaving(true);
    try {
      await uploadFiles(selected.id, Array.from(files));
      await openTask(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload attachment");
    } finally {
      setSaving(false);
    }
  };
  const downloadAttachment = async (item: ProjectAttachment) => {
    try {
      const blob = await api.download(
          `/projects/${projectId}/attachments/${item.id}`,
        ),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = item.originalName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not download attachment",
      );
    }
  };
  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !comment.trim()) return;
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/tasks/${selected.id}/comments`, {
        body: comment,
      });
      setComment("");
      await openTask(selected);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add comment");
    } finally {
      setSaving(false);
    }
  };
  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/projects/${projectId}/tasks/${selected.id}`, {
        title: selected.title,
        description: selected.description || "",
        priority: selected.priority,
        dueDate: selected.dueDate || null,
        estimatedHours: selected.estimatedHours,
        assigneeEmployeeIds: selected.assigneeEmployeeIds,
      });
      await load();
      setSelected(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update issue",
      );
    } finally {
      setSaving(false);
    }
  };
  const addMembers = async () => {
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/members`, {
        members: newMembers.map((employeeId) => ({
          employeeId,
          role: "member",
        })),
      });
      setNewMembers([]);
      setMemberModal(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add members");
    } finally {
      setSaving(false);
    }
  };
  const changeMemberRole = async (member: ProjectMember, role: string) => {
    try {
      await api.patch(`/projects/${projectId}/members/${member.employeeId}`, {
        role,
      });
      await load();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not change project role",
      );
    }
  };
  const removeProjectMember = async (member: ProjectMember) => {
    if (
      !window.confirm(
        `Remove ${member.employee?.firstName || "this member"} from the project? Assigned work will be deliberately unassigned.`,
      )
    )
      return;
    try {
      await api.delete(`/projects/${projectId}/members/${member.employeeId}`, {
        confirmUnassign: true,
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove member");
    }
  };
  const createColumn = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/workflow/statuses`, columnForm);
      setWorkflowModal(false);
      setColumnForm({
        name: "",
        category: "todo",
        color: "#7c8b84",
        timerAction: "none",
      });
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create column",
      );
    } finally {
      setSaving(false);
    }
  };
  const saveColumn = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingColumn) return;
    setSaving(true);
    try {
      await api.patch(
        `/projects/${projectId}/workflow/statuses/${editingColumn.id}`,
        editingColumn,
      );
      setEditingColumn(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update column",
      );
    } finally {
      setSaving(false);
    }
  };
  const reorderColumn = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= workflow.length) return;
    const ordered = [...workflow];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setWorkflow(ordered);
    try {
      await api.patch(`/projects/${projectId}/workflow/statuses/reorder`, {
        statusIds: ordered.map((x) => x.id),
      });
    } catch (e) {
      setWorkflow(workflow);
      setError(
        e instanceof ApiError ? e.message : "Could not reorder workflow",
      );
    }
  };
  const archiveColumn = async (status: WorkflowStatus) => {
    if (status.isDefault) {
      setError("Choose another default column before archiving this one.");
      return;
    }
    const replacement =
      workflow.find((x) => x.id !== status.id && x.isDefault) ||
      workflow.find((x) => x.id !== status.id);
    if (
      !replacement ||
      !window.confirm(
        `Archive ${status.name}? Any work in it will move to ${replacement.name}.`,
      )
    )
      return;
    try {
      await api.delete(
        `/projects/${projectId}/workflow/statuses/${status.id}`,
        { replacementStatusId: replacement.id },
      );
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not archive column");
    }
  };
  const toggleArchive = async () => {
    const restore = project?.status === "archived";
    if (
      !window.confirm(
        restore
          ? "Restore this project and make it editable again?"
          : "Archive this project? Its complete history will remain available in read-only mode.",
      )
    )
      return;
    try {
      await api.patch(`/projects/${projectId}/archive`, { restore });
      await load();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not update project status",
      );
    }
  };
  if (loading)
    return (
      <AppShell>
        <div className="loading-line" />
      </AppShell>
    );
  if (!project)
    return (
      <AppShell>
        <ErrorBanner message={error || "Project unavailable"} />
      </AppShell>
    );
  return (
    <AppShell>
      <div className="project-workspace">
        <header className="project-workspace-header">
          <div>
            <Link href={`${prefix}/projects`} className="project-back">
              <ArrowLeft size={15} />
              Projects
            </Link>
            <div className="project-title-row">
              <span>{project.key}</span>
              <h1>{project.name}</h1>
              <StatusPill value={project.status.replace("_", " ")} />
            </div>
          </div>
          <div className="project-header-actions">
            {admin && (
              <button
                className="button button-secondary"
                onClick={toggleArchive}
              >
                <Archive size={15} />
                {project.status === "archived" ? "Restore" : "Archive"}
              </button>
            )}
            <button
              className="button button-primary"
              disabled={project.status === "archived"}
              onClick={() => setTaskModal(true)}
            >
              <Plus size={16} />
              Create issue
            </button>
          </div>
        </header>
        {error && <ErrorBanner message={error} />}
        <div className="project-command-bar">
          <nav className="project-tabs">
            {tabs
              .filter((x) => !x.admin || admin)
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(id)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
          </nav>
          {(tab === "board" || tab === "tasks") && (
            <div className="board-toolbar">
              <div className="project-search">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search work"
                />
              </div>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">Priority</option>
                <option>low</option>
                <option>medium</option>
                <option>high</option>
                <option>critical</option>
              </select>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Assignee</option>
                {members.map((m) => (
                  <option key={m.employeeId} value={m.employeeId}>
                    {m.employee?.firstName} {m.employee?.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {tab === "overview" && (
          <div className="project-overview">
            <div className="project-overview-stats">
              <article>
                <ListChecks />
                <span>Total work</span>
                <strong>{tasks.length}</strong>
              </article>
              <article>
                <CheckCircle2 />
                <span>Completed</span>
                <strong>{completed}</strong>
              </article>
              <article>
                <Clock3 />
                <span>Overdue</span>
                <strong>{overdue}</strong>
              </article>
              <article>
                <Users />
                <span>Team members</span>
                <strong>{members.length}</strong>
              </article>
            </div>
            <div className="project-overview-grid">
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Workflow distribution</h2>
                    <p>Current work across the delivery pipeline.</p>
                  </div>
                </div>
                <div className="workflow-distribution">
                  {workflow.map((s) => {
                    const count = tasks.filter(
                      (t) => t.workflowStatusId === s.id,
                    ).length;
                    return (
                      <div key={s.id}>
                        <span>
                          <i style={{ background: s.color }} />
                          {s.name}
                          <b>{count}</b>
                        </span>
                        <em>
                          <i
                            style={{
                              width: `${tasks.length ? (count / tasks.length) * 100 : 0}%`,
                              background: s.color,
                            }}
                          />
                        </em>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Team</h2>
                    <p>People delivering this project.</p>
                  </div>
                </div>
                <div className="project-team-list">
                  {members.slice(0, 8).map((m) => (
                    <div key={m.id}>
                      <span className="avatar">
                        {m.employee?.firstName?.[0]}
                        {m.employee?.lastName?.[0]}
                      </span>
                      <div>
                        <strong>
                          {m.employee?.firstName} {m.employee?.lastName}
                        </strong>
                        <small>{m.role.replace("_", " ")}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
        {(tab === "board" || tab === "tasks") && (
          <>
            {tab === "board" ? (
              <div className="kanban-board">
                {workflow.map((status) => (
                  <section
                    className="kanban-column"
                    style={{ "--column-color": status.color } as CSSProperties}
                    key={status.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) =>
                      move(e.dataTransfer.getData("taskId"), status.id)
                    }
                  >
                    <header>
                      <span>
                        <i style={{ background: status.color }} />
                        {status.name}
                      </span>
                      <b>
                        {
                          filtered.filter(
                            (t) => t.workflowStatusId === status.id,
                          ).length
                        }
                      </b>
                    </header>
                    <div>
                      {filtered
                        .filter((t) => t.workflowStatusId === status.id)
                        .map((task) => (
                          <article
                            role="button"
                            tabIndex={0}
                            aria-selected={selected?.id === task.id}
                            draggable={project.status !== "archived"}
                            onDragStart={(e) =>
                              e.dataTransfer.setData("taskId", task.id)
                            }
                            onClick={() => openTask(task)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openTask(task);
                              }
                            }}
                            key={task.id}
                            className={`kanban-task task-priority-${task.priority}`}
                          >
                            <h3>{task.title}</h3>
                            <p
                              className={`task-card-description${task.description ? "" : " is-empty"}`}
                            >
                              {task.description || "No description added yet."}
                            </p>
                            {task.labels?.length ? (
                              <div className="task-labels">
                                {task.labels.slice(0, 3).map((label) => (
                                  <span key={label}>{label}</span>
                                ))}
                              </div>
                            ) : null}
                            <div className="task-meta">
                              <span
                                className={`priority priority-${task.priority}`}
                              >
                                {task.priority}
                              </span>
                              {task.dueDate && (
                                <time
                                  className={
                                    new Date(task.dueDate) < new Date() &&
                                    !doneIds.has(task.workflowStatusId)
                                      ? "overdue"
                                      : ""
                                  }
                                >
                                  <Calendar size={12} />
                                  {new Date(task.dueDate).toLocaleDateString()}
                                </time>
                              )}
                            </div>
                            <div className="task-card-footer">
                              <div className="assignee-stack">
                                {task.assignees?.slice(0, 4).map((x) => (
                                  <i key={x.id} title={x.name}>
                                    {x.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join("")}
                                  </i>
                                ))}
                              </div>
                              {task.timeStartedAt && (
                                <span className="task-live-timer">
                                  <Clock3 size={12} />
                                  {formatElapsed(elapsedSeconds(task, now))}
                                </span>
                              )}
                            </div>
                          </article>
                        ))}
                      <button
                        type="button"
                        className="kanban-create-task"
                        disabled={project.status === "archived"}
                        onClick={() => {
                          setTaskForm({
                            ...emptyTask,
                            workflowStatusId: status.id,
                          });
                          setTaskModal(true);
                        }}
                      >
                        <Plus size={14} />
                        Create task
                      </button>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <section className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Issue</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Assignees</th>
                        <th>Time</th>
                        <th>Due date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((task) => (
                        <tr key={task.id} onClick={() => openTask(task)}>
                          <td>
                            <strong>{task.key}</strong>
                          </td>
                          <td>
                            <span className={`issue-type type-${task.type}`}>
                              {task.type}
                            </span>{" "}
                            {task.title}
                          </td>
                          <td>
                            {
                              workflow.find(
                                (x) => x.id === task.workflowStatusId,
                              )?.name
                            }
                          </td>
                          <td>
                            <span
                              className={`priority priority-${task.priority}`}
                            >
                              {task.priority}
                            </span>
                          </td>
                          <td>
                            {task.assignees?.map((x) => x.name).join(", ") ||
                              "Unassigned"}
                          </td>
                          <td>{formatElapsed(elapsedSeconds(task, now))}</td>
                          <td>
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
        {tab === "members" && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Project members</h2>
                <p>Roles and access are specific to this project.</p>
              </div>
              {admin && (
                <button
                  className="button button-primary"
                  onClick={() => setMemberModal(true)}
                >
                  <Plus size={15} />
                  Add members
                </button>
              )}
            </div>
            <div className="member-grid">
              {members.map((m) => (
                <article key={m.id}>
                  <span className="avatar">
                    {m.employee?.firstName?.[0]}
                    {m.employee?.lastName?.[0]}
                  </span>
                  <div>
                    <strong>
                      {m.employee?.firstName} {m.employee?.lastName}
                    </strong>
                    <small>
                      {m.employee?.jobTitle || m.employee?.employeeCode}
                    </small>
                  </div>
                  {admin ? (
                    <div className="member-actions">
                      <select
                        value={m.role}
                        onChange={(e) => changeMemberRole(m, e.target.value)}
                      >
                        <option value="project_manager">Project manager</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        title="Remove member"
                        onClick={() => removeProjectMember(m)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="member-role">
                      {m.role.replace("_", " ")}
                    </span>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === "workflow" && admin && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Workflow columns</h2>
                <p>
                  Configure movement, access, and exactly where task timers
                  start or stop.
                </p>
              </div>
              <button
                className="button button-primary"
                onClick={() => setWorkflowModal(true)}
              >
                <Plus size={15} />
                Add column
              </button>
            </div>
            <div className="workflow-settings-list">
              {workflow.map((s, i) => (
                <article key={s.id}>
                  <i style={{ background: s.color }} />
                  <strong>{s.name}</strong>
                  <span>{s.category.replace("_", " ")}</span>
                  <small>Order {i + 1}</small>
                  {s.isDefault ? <b>Default</b> : <span>—</span>}
                  <span
                    className={`timer-behavior timer-${s.timerAction || s.category}`}
                  >
                    {s.timerAction === "start" ||
                    (!s.timerAction && s.category === "in_progress")
                      ? "Starts timer"
                      : s.timerAction === "stop" ||
                          (!s.timerAction && s.category === "done")
                        ? "Stops timer"
                        : "Timer unchanged"}
                  </span>
                  <div className="workflow-row-actions">
                    <button
                      title="Move left"
                      disabled={i === 0}
                      onClick={() => reorderColumn(i, -1)}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      title="Move right"
                      disabled={i === workflow.length - 1}
                      onClick={() => reorderColumn(i, 1)}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      title="Edit"
                      onClick={() =>
                        setEditingColumn({
                          ...s,
                          timerAction:
                            s.timerAction ||
                            (s.category === "in_progress"
                              ? "start"
                              : s.category === "done"
                                ? "stop"
                                : "none"),
                        })
                      }
                    >
                      <Pencil size={14} />
                    </button>
                    <button title="Archive" onClick={() => archiveColumn(s)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === "activity" && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Project activity</h2>
                <p>Important project, issue, member, and workflow events.</p>
              </div>
            </div>
            <div className="activity-timeline">
              {activities.map((a) => (
                <article key={a.id}>
                  <i />
                  <div>
                    <strong>{a.action.replaceAll(".", " ")}</strong>
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  {a.taskId && <small>Issue activity</small>}
                </article>
              ))}
              {!activities.length && (
                <EmptyState
                  title="No activity yet"
                  description="Project changes will appear here."
                />
              )}
            </div>
          </section>
        )}
        {taskModal && (
          <div className="modal-backdrop">
            <form
              className="modal project-modal issue-create-modal"
              onSubmit={createTask}
            >
              <div className="modal-header">
                <div>
                  <h2>
                    {canCreateStory ? "Create story or task" : "Create task"}
                  </h2>
                  <p>
                    {canCreateStory
                      ? "Plan a story or add actionable work."
                      : "Add actionable work to this project."}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setTaskModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                {error && <ErrorBanner message={error} />}
                <div className="form-grid">
                  <div className="field">
                    <label>Issue type</label>
                    <select
                      value={taskForm.type}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, type: e.target.value })
                      }
                    >
                      <option value="task">Task</option>
                      {canCreateStory && <option value="story">Story</option>}
                    </select>
                  </div>
                  <div className="field">
                    <label>Priority</label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, priority: e.target.value })
                      }
                    >
                      <option>low</option>
                      <option>medium</option>
                      <option>high</option>
                      <option>critical</option>
                    </select>
                  </div>
                  <div className="field full">
                    <label>Title</label>
                    <input
                      required
                      value={taskForm.title}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="field full">
                    <label>Description</label>
                    <textarea
                      rows={3}
                      value={taskForm.description}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field full">
                    <label>Assignees</label>
                    <div className="multi-picker assignee-picker">
                      {members
                        .filter((m) => m.role !== "viewer")
                        .map((m) => (
                          <label key={m.employeeId}>
                            <input
                              type="checkbox"
                              checked={taskForm.assigneeEmployeeIds.includes(
                                m.employeeId,
                              )}
                              onChange={(e) =>
                                setTaskForm({
                                  ...taskForm,
                                  assigneeEmployeeIds: e.target.checked
                                    ? [
                                        ...taskForm.assigneeEmployeeIds,
                                        m.employeeId,
                                      ]
                                    : taskForm.assigneeEmployeeIds.filter(
                                        (id) => id !== m.employeeId,
                                      ),
                                })
                              }
                            />
                            <span className="avatar">
                              {m.employee?.firstName?.[0]}
                              {m.employee?.lastName?.[0]}
                            </span>
                            <span>
                              {m.employee?.firstName} {m.employee?.lastName}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                  <div className="field">
                    <label>Workflow status</label>
                    <select
                      value={taskForm.workflowStatusId}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          workflowStatusId: e.target.value,
                        })
                      }
                    >
                      <option value="">Project default</option>
                      {workflow.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Due date</label>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, dueDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Estimated hours</label>
                    <input
                      type="number"
                      min="0"
                      value={taskForm.estimatedHours}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          estimatedHours: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Labels</label>
                    <input
                      placeholder="api, qa, urgent"
                      value={taskForm.labels}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, labels: e.target.value })
                      }
                    />
                  </div>
                  <div className="field full">
                    <label>Files and screenshots</label>
                    <label className="attachment-drop">
                      <FileUp size={18} />
                      <span>
                        {pendingFiles.length
                          ? `${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} selected`
                          : "Choose screenshots or files up to 8 MB each"}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.txt,.csv,.zip,.docx,.xlsx"
                        onChange={(e) =>
                          setPendingFiles(Array.from(e.target.files || []))
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setTaskModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary create-issue-submit"
                  disabled={saving}
                >
                  <Plus size={16} />
                  {saving
                    ? "Creating…"
                    : taskForm.type === "story"
                      ? "Create story"
                      : "Create task"}
                </button>
              </div>
            </form>
          </div>
        )}
        {selected && (
          <div className="task-drawer-scrim" onClick={() => setSelected(null)}>
            <aside className="task-drawer" onClick={(e) => e.stopPropagation()}>
              <header>
                <div>
                  <span className={`issue-type type-${selected.type}`}>
                    {selected.type}
                  </span>
                  <b>{selected.key}</b>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setSelected(null)}
                >
                  <X size={18} />
                </button>
              </header>
              <div className="task-timer-summary">
                <Clock3 size={16} />
                <div>
                  <span>
                    {selected.timeStartedAt
                      ? "Timer running"
                      : selected.timeStoppedAt
                        ? "Timer stopped"
                        : "Timer not started"}
                  </span>
                  <strong>{formatElapsed(elapsedSeconds(selected, now))} recorded</strong>
                </div>
              </div>
              <div className="drawer-edit-fields">
                <div className="field">
                  <label>Title</label>
                  <input
                    value={selected.title}
                    onChange={(e) =>
                      setSelected({ ...selected, title: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Description</label>
                  <textarea
                    rows={4}
                    value={selected.description || ""}
                    onChange={(e) =>
                      setSelected({ ...selected, description: e.target.value })
                    }
                  />
                </div>
                <div className="task-detail-grid">
                  <div>
                    <span>Status</span>
                    <strong>
                      {
                        workflow.find((x) => x.id === selected.workflowStatusId)
                          ?.name
                      }
                    </strong>
                  </div>
                  <div className="field">
                    <label>Priority</label>
                    <select
                      value={selected.priority}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          priority: e.target.value as ProjectTask["priority"],
                        })
                      }
                    >
                      <option>low</option>
                      <option>medium</option>
                      <option>high</option>
                      <option>critical</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Due date</label>
                    <input
                      type="date"
                      value={selected.dueDate?.slice(0, 10) || ""}
                      onChange={(e) =>
                        setSelected({ ...selected, dueDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Estimated hours</label>
                    <input
                      type="number"
                      min="0"
                      value={selected.estimatedHours ?? ""}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          estimatedHours: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Assignees</label>
                  <div className="multi-picker">
                    {members
                      .filter((m) => m.role !== "viewer")
                      .map((m) => (
                        <label key={m.employeeId}>
                          <input
                            type="checkbox"
                            checked={selected.assigneeEmployeeIds.includes(
                              m.employeeId,
                            )}
                            onChange={(e) =>
                              setSelected({
                                ...selected,
                                assigneeEmployeeIds: e.target.checked
                                  ? [
                                      ...selected.assigneeEmployeeIds,
                                      m.employeeId,
                                    ]
                                  : selected.assigneeEmployeeIds.filter(
                                      (id) => id !== m.employeeId,
                                    ),
                              })
                            }
                          />
                          {m.employee?.firstName} {m.employee?.lastName}
                        </label>
                      ))}
                  </div>
                </div>
                <button
                  className="button button-primary drawer-save"
                  disabled={saving || project.status === "archived"}
                  onClick={saveSelected}
                >
                  Save issue details
                </button>
              </div>
              <section className="drawer-attachments">
                <h3>
                  <Paperclip size={16} />
                  Files and screenshots
                </h3>
                <label className="attachment-drop compact">
                  <FileUp size={16} />
                  <span>Upload files</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.csv,.zip,.docx,.xlsx"
                    onChange={(e) => attachToSelected(e.target.files)}
                  />
                </label>
                {attachments.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => downloadAttachment(item)}
                  >
                    <span>
                      <Paperclip size={14} />
                      <b>{item.originalName}</b>
                      <small>{Math.ceil(item.size / 1024)} KB</small>
                    </span>
                    <Download size={15} />
                  </button>
                ))}
              </section>
              <section className="drawer-comments">
                <h3>
                  <MessageSquare size={16} />
                  Comments
                </h3>
                {comments.map((c) => (
                  <article key={c.id}>
                    <span className="avatar">
                      {members.find((m) => m.employeeId === c.authorEmployeeId)
                        ?.employee?.firstName?.[0] || "U"}
                    </span>
                    <div>
                      <p>{c.body}</p>
                      <small>{new Date(c.createdAt).toLocaleString()}</small>
                    </div>
                  </article>
                ))}
                <form onSubmit={addComment}>
                  <textarea
                    required
                    rows={3}
                    placeholder="Write a comment…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button
                    className="button button-primary"
                    disabled={saving || project.status === "archived"}
                  >
                    Add comment
                  </button>
                </form>
              </section>
            </aside>
          </div>
        )}
        {memberModal && (
          <div className="modal-backdrop">
            <div className="modal project-modal">
              <div className="modal-header">
                <div>
                  <h2>Add project members</h2>
                  <p>Select active employees from your organization.</p>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setMemberModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="employee-picker">
                  {employees
                    .filter((e) => !members.some((m) => m.employeeId === e.id))
                    .map((e) => (
                      <label key={e.id}>
                        <input
                          type="checkbox"
                          checked={newMembers.includes(e.id)}
                          onChange={(x) =>
                            setNewMembers(
                              x.target.checked
                                ? [...newMembers, e.id]
                                : newMembers.filter((id) => id !== e.id),
                            )
                          }
                        />
                        <span className="avatar">
                          {e.firstName[0]}
                          {e.lastName[0]}
                        </span>
                        <span>
                          <strong>
                            {e.firstName} {e.lastName}
                          </strong>
                          <small>{e.jobTitle || e.employeeCode}</small>
                        </span>
                      </label>
                    ))}
                </div>
              </div>
              <div className="modal-actions">
                <button
                  className="button button-secondary"
                  onClick={() => setMemberModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  disabled={!newMembers.length || saving}
                  onClick={addMembers}
                >
                  Add {newMembers.length} members
                </button>
              </div>
            </div>
          </div>
        )}
        {workflowModal && (
          <div className="modal-backdrop">
            <form className="modal" onSubmit={createColumn}>
              <div className="modal-header">
                <div>
                  <h2>Add workflow column</h2>
                  <p>
                    Create a status and choose what entering it does to the task
                    timer.
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setWorkflowModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="field">
                  <label>Name</label>
                  <input
                    required
                    value={columnForm.name}
                    onChange={(e) =>
                      setColumnForm({ ...columnForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select
                    value={columnForm.category}
                    onChange={(e) =>
                      setColumnForm({ ...columnForm, category: e.target.value })
                    }
                  >
                    <option value="todo">To do</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className="field">
                  <label>Colour</label>
                  <input
                    type="color"
                    value={columnForm.color}
                    onChange={(e) =>
                      setColumnForm({ ...columnForm, color: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Timer behavior</label>
                  <select
                    value={columnForm.timerAction}
                    onChange={(e) =>
                      setColumnForm({
                        ...columnForm,
                        timerAction: e.target.value as
                          "none" | "start" | "stop",
                      })
                    }
                  >
                    <option value="none">Keep timer unchanged</option>
                    <option value="start">Start or resume timer</option>
                    <option value="stop">Stop and record time</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setWorkflowModal(false)}
                >
                  Cancel
                </button>
                <button className="button button-primary" disabled={saving}>
                  Add column
                </button>
              </div>
            </form>
          </div>
        )}
        {editingColumn && (
          <div className="modal-backdrop">
            <form className="modal project-modal" onSubmit={saveColumn}>
              <div className="modal-header">
                <div>
                  <h2>Edit workflow column</h2>
                  <p>
                    Configure its label, timer, transitions and move
                    permissions.
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setEditingColumn(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>Name</label>
                    <input
                      required
                      value={editingColumn.name}
                      onChange={(e) =>
                        setEditingColumn({
                          ...editingColumn,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Category</label>
                    <select
                      value={editingColumn.category}
                      onChange={(e) =>
                        setEditingColumn({
                          ...editingColumn,
                          category: e.target
                            .value as WorkflowStatus["category"],
                        })
                      }
                    >
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Colour</label>
                    <input
                      type="color"
                      value={editingColumn.color}
                      onChange={(e) =>
                        setEditingColumn({
                          ...editingColumn,
                          color: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Timer behavior</label>
                    <select
                      value={editingColumn.timerAction || "none"}
                      onChange={(e) =>
                        setEditingColumn({
                          ...editingColumn,
                          timerAction: e.target
                            .value as WorkflowStatus["timerAction"],
                        })
                      }
                    >
                      <option value="none">Keep timer unchanged</option>
                      <option value="start">Start or resume timer</option>
                      <option value="stop">Stop and record time</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={editingColumn.isDefault}
                        onChange={(e) =>
                          setEditingColumn({
                            ...editingColumn,
                            isDefault: e.target.checked,
                          })
                        }
                      />
                      Default for new issues
                    </label>
                  </div>
                  <div className="field full">
                    <label>Allowed transitions</label>
                    <div className="multi-picker">
                      {workflow
                        .filter((x) => x.id !== editingColumn.id)
                        .map((target) => (
                          <label key={target.id}>
                            <input
                              type="checkbox"
                              checked={editingColumn.allowedTransitionIds.includes(
                                target.id,
                              )}
                              onChange={(e) =>
                                setEditingColumn({
                                  ...editingColumn,
                                  allowedTransitionIds: e.target.checked
                                    ? [
                                        ...editingColumn.allowedTransitionIds,
                                        target.id,
                                      ]
                                    : editingColumn.allowedTransitionIds.filter(
                                        (id) => id !== target.id,
                                      ),
                                })
                              }
                            />
                            <i style={{ background: target.color }} />
                            {target.name}
                          </label>
                        ))}
                    </div>
                  </div>
                  <div className="field full">
                    <label>Roles allowed to move tasks</label>
                    <div className="multi-picker">
                      {[
                        { id: "project_manager", label: "Project Manager" },
                        { id: "member", label: "Member" },
                        { id: "viewer", label: "Viewer" },
                      ].map((role) => (
                        <label key={role.id}>
                          <input
                            type="checkbox"
                            checked={editingColumn.moveRoles.includes(role.id)}
                            onChange={(e) =>
                              setEditingColumn({
                                ...editingColumn,
                                moveRoles: e.target.checked
                                  ? [...editingColumn.moveRoles, role.id]
                                  : editingColumn.moveRoles.filter(
                                      (id) => id !== role.id,
                                    ),
                              })
                            }
                          />
                          {role.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setEditingColumn(null)}
                >
                  Cancel
                </button>
                <button className="button button-primary" disabled={saving}>
                  Save workflow
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}
