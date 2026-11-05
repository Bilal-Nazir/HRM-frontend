"use client";

import {
  Activity,
  AtSign,
  BellRing,
  Bookmark,
  Archive,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock3,
  Columns3,
  Download,
  Equal,
  FileUp,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
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
  ProjectReminder,
  ProjectTask,
  WorkflowStatus,
} from "@/types";

type Tab = "overview" | "board" | "tasks" | "calendar" | "members" | "workflow" | "activity" | "trash";
const tabs: {
  id: Tab;
  label: string;
  icon: typeof Columns3;
  admin?: boolean;
}[] = [
  { id: "overview", label: "Overview", icon: CircleDot },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "tasks", label: "Stories & tasks", icon: ListChecks },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "members", label: "Members", icon: Users },
  { id: "workflow", label: "Workflow settings", icon: Settings2, admin: true },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "trash", label: "Deleted tasks", icon: Trash2 },
];
const emptyTask = {
  type: "task",
  title: "",
  description: "",
  priority: "medium",
  workflowStatusId: "",
  assigneeEmployeeIds: [] as string[],
  startDate: "",
  dueDate: "",
  estimatedHours: "",
  labels: "",
};
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const toLocalDateTimeInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
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
const boardTitle = (task: ProjectTask) => task.title.replace(new RegExp(`^${task.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[-–—:]\\s*`, "i"), "").trim() || task.title;

export default function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>(),
    pathname = usePathname(),
    router = useRouter(),
    searchParams = useSearchParams(),
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
    [deletedTasks, setDeletedTasks] = useState<ProjectTask[]>([]),
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
    [reminders, setReminders] = useState<ProjectReminder[]>([]),
    [pendingFiles, setPendingFiles] = useState<File[]>([]),
    [comment, setComment] = useState(""),
    [mentionedEmployeeIds, setMentionedEmployeeIds] = useState<string[]>([]),
    [mentionQuery, setMentionQuery] = useState<string | null>(null),
    [calendarQuickOpen, setCalendarQuickOpen] = useState(false),
    [calendarQuick, setCalendarQuick] = useState({ kind: "task" as "task" | "reminder", title: "", note: "", scheduledAt: "" }),
    [saving, setSaving] = useState(false),
    [search, setSearch] = useState(""),
    [priority, setPriority] = useState(""),
    [assignee, setAssignee] = useState(""),
    [taskMenu, setTaskMenu] = useState<string | null>(null),
    [inlineEditingTaskId, setInlineEditingTaskId] = useState<string | null>(null),
    [inlineTitle, setInlineTitle] = useState(""),
    [inlineSavingTaskId, setInlineSavingTaskId] = useState<string | null>(null),
    [calendarView, setCalendarView] = useState<"month" | "week">("month"),
    [calendarCursor, setCalendarCursor] = useState(() => new Date()),
    [taskForm, setTaskForm] = useState(emptyTask),
    [newMembers, setNewMembers] = useState<string[]>([]),
    [columnForm, setColumnForm] = useState({
      name: "",
      category: "todo",
      color: "#7c8b84",
      timerAction: "none" as "none" | "start" | "stop",
    });
  const moving = useRef(new Set<string>());
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const cancelInlineEdit = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detail, taskData, activityData, reminderData, trashData] = await Promise.all([
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
        api.get<{ reminders: ProjectReminder[] }>(`/projects/${projectId}/reminders`),
        api.get<{ tasks: ProjectTask[] }>(`/projects/${projectId}/tasks-trash`),
      ]);
      setProject(detail.project);
      setMembers(detail.members);
      setWorkflow(detail.workflow.filter((x) => !x.isArchived));
      setTasks(taskData.tasks);
      setActivities(activityData.activity);
      setReminders(reminderData.reminders || []);
      setDeletedTasks(trashData.tasks || []);
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
    const requested = searchParams.get("view") as Tab | null;
    const fallback = tabs.some((item) => item.id === inferred) ? inferred : "overview";
    setTab(requested && tabs.some((item) => item.id === requested) ? requested : fallback);
    setAssignee(searchParams.get("assignee") || "");
  }, [searchParams, inferred]);
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
  const currentMembership = members.find((member) => member.employeeId === session?.employeeId),
    canModifyTasks = admin || currentMembership?.role !== "viewer",
    canPermanentlyDelete = admin || currentMembership?.role === "project_manager";
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
  const setProjectQuery = (key: "view" | "assignee", value: string, push = false) => {
    const query = new URLSearchParams(searchParams.toString());
    if (value) query.set(key, value);
    else query.delete(key);
    const target = `${pathname}${query.size ? `?${query.toString()}` : ""}`;
    if (push) router.push(target, { scroll: false });
    else router.replace(target, { scroll: false });
  };
  const calendarTasks = useMemo(() => filtered.filter((task) => task.startDate || task.dueDate), [filtered]);
  const tasksForDay = useCallback((day: Date) => calendarTasks.filter((task) => localDateKey(new Date(task.startDate || task.dueDate || "")) === localDateKey(day)), [calendarTasks]);
  const remindersForDay = useCallback((day: Date) => reminders.filter((reminder) => localDateKey(new Date(reminder.scheduledAt)) === localDateKey(day)), [reminders]);
  const monthCells = useMemo(() => {
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  }, [calendarCursor]);
  const weekDays = useMemo(() => {
    const start = new Date(calendarCursor);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  }, [calendarCursor]);
  const calendarHours = useMemo(() => Array.from({ length: 14 }, (_, index) => index + 7), []);
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
  const openCalendarQuickCreate = (day = new Date(), hour = 9) => {
    const scheduled = new Date(day);
    scheduled.setHours(hour, 0, 0, 0);
    setCalendarQuick({ kind: "task", title: "", note: "", scheduledAt: toLocalDateTimeInput(scheduled.toISOString()) });
    setCalendarQuickOpen(true);
  };
  const createCalendarItem = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (calendarQuick.kind === "task") {
        const selfMember = members.find((member) => member.employeeId === session?.employeeId);
        await api.post(`/projects/${projectId}/tasks`, { type: "task", title: calendarQuick.title, description: calendarQuick.note, priority: "medium", startDate: calendarQuick.scheduledAt, assigneeEmployeeIds: selfMember ? [selfMember.employeeId] : [] });
      } else {
        await api.post(`/projects/${projectId}/reminders`, { title: calendarQuick.title, note: calendarQuick.note, scheduledAt: calendarQuick.scheduledAt });
      }
      setCalendarQuickOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create calendar item");
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
  const requestedTaskId = searchParams.get("task");
  useEffect(() => {
    if (!requestedTaskId || loading || !project) return;
    let cancelled = false;
    api.get<{ task: ProjectTask; comments: ProjectComment[]; attachments: ProjectAttachment[] }>(`/projects/${projectId}/tasks/${requestedTaskId}`)
      .then((data) => { if (!cancelled) { setSelected(data.task); setComments(data.comments || []); setAttachments(data.attachments || []); } })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not open linked task"); });
    return () => { cancelled = true; };
  }, [requestedTaskId, loading, projectId, project]);
  const closeTask = () => {
    setSelected(null);
    if (requestedTaskId) {
      const query = new URLSearchParams(window.location.search);
      query.delete("task");
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    }
  };
  const beginInlineEdit = (task: ProjectTask) => {
    cancelInlineEdit.current = false;
    setTaskMenu(null);
    setInlineEditingTaskId(task.id);
    setInlineTitle(boardTitle(task));
  };
  const saveInlineTitle = async (task: ProjectTask) => {
    if (inlineSavingTaskId === task.id) return;
    const title = inlineTitle.trim();
    if (!title) { setInlineEditingTaskId(null); setInlineTitle(""); return; }
    if (title === boardTitle(task)) { setInlineEditingTaskId(null); return; }
    setInlineSavingTaskId(task.id);
    try {
      const result = await api.patch<{ task: ProjectTask }>(`/projects/${projectId}/tasks/${task.id}`, { title });
      setTasks((rows) => rows.map((row) => row.id === task.id ? { ...row, ...result.task, assignees: row.assignees } : row));
      setInlineEditingTaskId(null);
      setInlineTitle("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not rename task");
    } finally {
      setInlineSavingTaskId(null);
    }
  };
  const deleteTask = async (task: ProjectTask) => {
    setTaskMenu(null);
    if (!window.confirm(`Delete ${task.key} — ${task.title}? This task will be removed from the project board.`)) return;
    try {
      await api.delete(`/projects/${projectId}/tasks/${task.id}`);
      setTasks((rows) => rows.filter((row) => row.id !== task.id));
      setDeletedTasks((rows) => [{ ...task, isDeleted: true }, ...rows]);
      if (selected?.id === task.id) closeTask();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete task");
    }
  };
  const restoreTask = async (task: ProjectTask) => {
    try {
      await api.patch(`/projects/${projectId}/tasks/${task.id}/restore`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not restore task");
    }
  };
  const permanentlyDeleteTask = async (task: ProjectTask) => {
    if (!window.confirm(`Permanently delete ${task.key}? This cannot be undone and its comments and files will also be removed.`)) return;
    try {
      await api.delete(`/projects/${projectId}/tasks/${task.id}/permanent`);
      setDeletedTasks((rows) => rows.filter((row) => row.id !== task.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not permanently delete task");
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
  const openAttachment = async (item: ProjectAttachment) => {
    try {
      const blob = await api.download(
          `/projects/${projectId}/attachments/${item.id}`,
        );
      const url = URL.createObjectURL(blob);
      if (item.mimeType.startsWith("image/") || item.mimeType === "application/pdf") {
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = item.originalName;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not download attachment",
      );
    }
  };
  const changeTimer = async (action: "start" | "pause") => {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await api.patch<{ task: ProjectTask }>(`/projects/${projectId}/tasks/${selected.id}/timer`, { action });
      const timerState = action === "pause" ? { timeStartedAt: undefined, timeStoppedAt: result.task.timeStoppedAt || new Date().toISOString() } : { timeStartedAt: result.task.timeStartedAt || new Date().toISOString(), timeStoppedAt: undefined };
      setSelected({ ...selected, ...result.task, ...timerState });
      setTasks((rows) => rows.map((task) => task.id === selected.id ? { ...task, ...result.task, ...timerState } : task));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update timer");
    } finally {
      setSaving(false);
    }
  };
  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !comment.trim()) return;
    setSaving(true);
    try {
      const activeMentionIds = mentionedEmployeeIds.filter((id) => { const code = members.find((member) => member.employeeId === id)?.employee?.employeeCode; return code ? comment.includes(`@${code}`) : false; });
      await api.post(`/projects/${projectId}/tasks/${selected.id}/comments`, {
        body: comment,
        mentionedEmployeeIds: activeMentionIds,
      });
      setComment("");
      setMentionedEmployeeIds([]);
      setMentionQuery(null);
      await openTask(selected);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add comment");
    } finally {
      setSaving(false);
    }
  };
  const changeComment = (value: string, caret: number) => {
    setComment(value);
    const match = value.slice(0, caret).match(/(?:^|\s)@([\w-]*)$/);
    setMentionQuery(match ? match[1] : null);
  };
  const mentionSuggestions = mentionQuery === null ? [] : members.filter((member) => {
    const person = member.employee;
    if (!person) return false;
    const searchValue = `${person.firstName} ${person.lastName} ${person.employeeCode}`.toLowerCase();
    return searchValue.includes(mentionQuery.toLowerCase());
  }).slice(0, 6);
  const insertMention = (member: ProjectMember) => {
    if (!member.employee || !commentInput.current) return;
    const caret = commentInput.current.selectionStart ?? comment.length;
    const before = comment.slice(0, caret).replace(/@[\w-]*$/, `@${member.employee.employeeCode} `);
    const next = before + comment.slice(caret);
    setComment(next);
    setMentionedEmployeeIds((ids) => [...new Set([...ids, member.employeeId])]);
    setMentionQuery(null);
    requestAnimationFrame(() => { commentInput.current?.focus(); commentInput.current?.setSelectionRange(before.length, before.length); });
  };
  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/projects/${projectId}/tasks/${selected.id}`, {
        title: selected.title,
        description: selected.description || "",
        priority: selected.priority,
        startDate: selected.startDate || null,
        dueDate: selected.dueDate || null,
        estimatedHours: selected.estimatedHours,
        assigneeEmployeeIds: selected.assigneeEmployeeIds,
      });
      await load();
      closeTask();
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
                  onClick={() => { setTab(id); setProjectQuery("view", id, true); }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
          </nav>
          {(tab === "board" || tab === "tasks" || tab === "calendar") && (
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
              <div className="assignee-profile-filter" aria-label="Filter by assignee">
                <button type="button" className={!assignee ? "active" : ""} onClick={() => { setAssignee(""); setProjectQuery("assignee", ""); }} title="All assignees">All</button>
                {members.filter((m) => m.employee).map((m) => (
                  <button type="button" key={m.employeeId} className={assignee === m.employeeId ? "active" : ""} onClick={() => { const next = assignee === m.employeeId ? "" : m.employeeId; setAssignee(next); setProjectQuery("assignee", next); }} title={`${m.employee?.firstName} ${m.employee?.lastName}`}>
                    {m.employee?.firstName?.[0]}{m.employee?.lastName?.[0]}
                  </button>
                ))}
              </div>
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
              <div className="kanban-shell">
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
                    <div className="kanban-column-body">
                      <div className="kanban-task-scroll">
                      {filtered
                        .filter((t) => t.workflowStatusId === status.id)
                        .map((task) => (
                          <article
                            role="button"
                            tabIndex={0}
                            aria-selected={selected?.id === task.id}
                            draggable={project.status !== "archived" && inlineEditingTaskId !== task.id}
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
                            <button
                              type="button"
                              className="task-card-edit-trigger"
                              aria-label={`Edit ${task.key}`}
                              onClick={(event) => { event.stopPropagation(); beginInlineEdit(task); }}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="task-card-menu-trigger"
                              aria-label={`More actions for ${task.key}`}
                              aria-expanded={taskMenu === task.id}
                              onClick={(event) => { event.stopPropagation(); setTaskMenu(taskMenu === task.id ? null : task.id); }}
                            >
                              <MoreHorizontal size={17} />
                            </button>
                            {taskMenu === task.id && (
                              <div className="task-card-menu" onClick={(event) => event.stopPropagation()}>
                                <button type="button" onClick={() => { setTaskMenu(null); openTask(task); }}>Open task</button>
                                <button type="button" onClick={() => { navigator.clipboard.writeText(task.key); setTaskMenu(null); }}>Copy key</button>
                                <button type="button" className="danger" onClick={() => deleteTask(task)}><Trash2 size={14} />Delete task</button>
                              </div>
                            )}
                            {inlineEditingTaskId === task.id ? <textarea
                              className="task-inline-title"
                              autoFocus
                              rows={3}
                              value={inlineTitle}
                              disabled={inlineSavingTaskId === task.id}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => setInlineTitle(event.target.value)}
                              onBlur={() => { if (cancelInlineEdit.current) { cancelInlineEdit.current = false; return; } void saveInlineTitle(task); }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === "Escape") { event.preventDefault(); cancelInlineEdit.current = true; setInlineEditingTaskId(null); setInlineTitle(""); }
                                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.blur(); }
                              }}
                            /> : <h3>{boardTitle(task)}</h3>}
                            <div className="jira-task-footer">
                              <span className="task-card-key"><Bookmark size={16} />{task.key}</span>
                              <div className="jira-task-actions">
                              <span className={`jira-priority priority-${task.priority}`} title={`${task.priority} priority`}><Equal size={18} /></span>
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
                              <div className="assignee-stack">
                                {task.assignees?.length ? task.assignees.slice(0, 4).map((x) => (
                                  <i key={x.id} title={x.name}>
                                    {x.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join("")}
                                  </i>
                                )) : <i className="unassigned" title="Unassigned"><UserRound size={15} /></i>}
                              </div>
                              {task.timeStartedAt && (
                                <span className="task-live-timer">
                                  <Clock3 size={12} />
                                  {formatElapsed(elapsedSeconds(task, now))}
                                </span>
                              )}
                              </div>
                            </div>
                          </article>
                        ))}
                      {["todo", "in_progress"].includes(status.category) && <button type="button" className="kanban-create-task" disabled={project.status === "archived"} onClick={() => { setTaskForm({ ...emptyTask, workflowStatusId: status.id }); setTaskModal(true); }}><Plus size={14} />Create task</button>}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
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
                    <span>{new Date(a.createdAt).toLocaleString([], { hour12: true })}</span>
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
        {tab === "trash" && (
          <section className="card deleted-task-panel">
            <div className="card-header">
              <div><h2>Deleted tasks</h2><p>Restore work or permanently remove records you no longer need.</p></div>
              <span className="deleted-task-count">{deletedTasks.length}</span>
            </div>
            {deletedTasks.length ? <div className="deleted-task-list">
              {deletedTasks.map((task) => <article key={task.id}>
                <div><span><Bookmark size={15}/>{task.key}</span><strong>{boardTitle(task)}</strong><small>Deleted {task.updatedAt ? new Date(task.updatedAt).toLocaleString([], { hour12: true }) : "recently"}</small></div>
                {canModifyTasks && <div className="deleted-task-actions"><button type="button" className="button button-secondary" onClick={() => restoreTask(task)}>Restore</button>{canPermanentlyDelete && <button type="button" className="button button-danger" onClick={() => permanentlyDeleteTask(task)}><Trash2 size={14}/>Delete permanently</button>}</div>}
              </article>)}
            </div> : <EmptyState title="Trash is empty" description="Deleted project tasks will appear here and can be restored."/>}
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
                      {workflow.filter((s) => ["todo", "in_progress"].includes(s.category)).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Schedule start</label>
                    <input
                      type="datetime-local"
                      value={taskForm.startDate}
                      onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                    />
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
        {tab === "calendar" && (
          <section className="card project-calendar">
            <div className="calendar-controls">
              <button type="button" className="button button-secondary" onClick={() => setCalendarCursor(new Date())}>Today</button>
              <button type="button" className="button button-primary" onClick={() => openCalendarQuickCreate(calendarCursor)}><Plus size={15}/>Add task or reminder</button>
              <div className="calendar-navigation"><button type="button" className="icon-button" aria-label="Previous period" onClick={() => setCalendarCursor((value) => { const next = new Date(value); calendarView === "month" ? next.setMonth(next.getMonth() - 1) : next.setDate(next.getDate() - 7); return next; })}><ChevronLeft size={18}/></button><strong>{calendarCursor.toLocaleDateString([], { month: "long", year: "numeric" })}</strong><button type="button" className="icon-button" aria-label="Next period" onClick={() => setCalendarCursor((value) => { const next = new Date(value); calendarView === "month" ? next.setMonth(next.getMonth() + 1) : next.setDate(next.getDate() + 7); return next; })}><ChevronRight size={18}/></button></div>
              <select aria-label="Calendar view" value={calendarView} onChange={(e) => setCalendarView(e.target.value as "month" | "week")}><option value="month">Month</option><option value="week">Week · hourly</option></select>
            </div>
            {calendarView === "month" ? <div className="calendar-month-grid">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
              {monthCells.map((day) => { const rows = tasksForDay(day); const dayReminders = remindersForDay(day); const isToday = localDateKey(day) === localDateKey(new Date()); return <div key={day.toISOString()} className={`calendar-day${day.getMonth() !== calendarCursor.getMonth() ? " outside" : ""}${isToday ? " today" : ""}`}><time>{day.getDate()}</time><button type="button" className="calendar-cell-add" title="Add task or reminder" onClick={() => openCalendarQuickCreate(day)}><Plus size={13}/></button><div>{rows.slice(0, 3).map((task) => <button type="button" key={task.id} className={`calendar-event priority-${task.priority}`} onClick={() => openTask(task)} title={task.title}><strong>{task.startDate ? new Date(task.startDate).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",hour12:true}) : "Due"}</strong> {task.title}</button>)}{dayReminders.slice(0, 2).map((reminder) => <button type="button" key={reminder.id} className="calendar-event calendar-reminder" title={reminder.note || reminder.title}><BellRing size={11}/><strong>{new Date(reminder.scheduledAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",hour12:true})}</strong> {reminder.title}</button>)}{rows.length + dayReminders.length > 5 && <small>+{rows.length + dayReminders.length - 5} more</small>}</div></div>; })}
            </div> : <div className="calendar-week-scroll"><div className="calendar-week-grid"><div className="calendar-time-corner"/>{weekDays.map((day) => <div className={`calendar-week-head${localDateKey(day) === localDateKey(new Date()) ? " today" : ""}`} key={day.toISOString()}><span>{day.toLocaleDateString([], {weekday:"short"})}</span><strong>{day.getDate()}</strong></div>)}{calendarHours.map((hour) => <div className="calendar-hour-row" key={hour}><time>{new Date(2020,0,1,hour).toLocaleTimeString([], {hour:"numeric",hour12:true})}</time>{weekDays.map((day) => { const rows = tasksForDay(day).filter((task) => (task.startDate ? new Date(task.startDate).getHours() : 9) === hour); const hourReminders = remindersForDay(day).filter((reminder) => new Date(reminder.scheduledAt).getHours() === hour); return <div className="calendar-hour-cell" key={`${day.toISOString()}-${hour}`} onDoubleClick={() => openCalendarQuickCreate(day, hour)}><button type="button" className="calendar-hour-add" aria-label="Add calendar item" onClick={() => openCalendarQuickCreate(day, hour)}><Plus size={11}/></button>{rows.map((task) => <button type="button" key={task.id} className={`calendar-event priority-${task.priority}`} onClick={() => openTask(task)}><strong>{task.startDate ? new Date(task.startDate).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",hour12:true}) : "9:00 AM"}</strong><span>{task.title}</span></button>)}{hourReminders.map((reminder) => <button type="button" key={reminder.id} className="calendar-event calendar-reminder"><BellRing size={10}/><strong>{new Date(reminder.scheduledAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",hour12:true})}</strong><span>{reminder.title}</span></button>)}</div>; })}</div>)}</div></div>}
            {!calendarTasks.length && !reminders.length && <EmptyState title="No scheduled work" description="Click any date or hour to add a task or reminder." />}
          </section>
        )}
        {calendarQuickOpen && <div className="modal-backdrop"><form className="modal project-modal calendar-quick-modal" onSubmit={createCalendarItem}><div className="modal-header"><div><h2>Add to calendar</h2><p>Create scheduled work or a shared project reminder.</p></div><button type="button" className="icon-button" onClick={() => setCalendarQuickOpen(false)}><X size={18}/></button></div><div className="modal-body">{error && <ErrorBanner message={error}/>}<div className="calendar-kind-picker"><button type="button" className={calendarQuick.kind === "task" ? "active" : ""} onClick={() => setCalendarQuick({...calendarQuick,kind:"task"})}><ListChecks size={18}/><span><strong>Task</strong><small>Add scheduled work to the board</small></span></button><button type="button" className={calendarQuick.kind === "reminder" ? "active" : ""} onClick={() => setCalendarQuick({...calendarQuick,kind:"reminder"})}><BellRing size={18}/><span><strong>Reminder</strong><small>Add a shared calendar reminder</small></span></button></div><div className="form-grid"><div className="field full"><label>{calendarQuick.kind === "task" ? "Task title" : "Reminder title"}</label><input required autoFocus value={calendarQuick.title} onChange={(e) => setCalendarQuick({...calendarQuick,title:e.target.value})}/></div><div className="field full"><label>Date and time</label><input required type="datetime-local" value={calendarQuick.scheduledAt} onChange={(e) => setCalendarQuick({...calendarQuick,scheduledAt:e.target.value})}/></div><div className="field full"><label>Details (optional)</label><textarea rows={3} value={calendarQuick.note} onChange={(e) => setCalendarQuick({...calendarQuick,note:e.target.value})}/></div></div>{calendarQuick.kind === "task" && <p className="calendar-quick-note">The task starts in the project’s default workflow column and is assigned to you when possible. You can edit all details afterward.</p>}</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setCalendarQuickOpen(false)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving?"Creating…":calendarQuick.kind === "task"?"Create task":"Create reminder"}</button></div></form></div>}
        {selected && (
          <div className="task-drawer-scrim" onClick={closeTask}>
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
                  onClick={closeTask}
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
                <button type="button" className="button button-secondary" disabled={saving || project.status === "archived"} onClick={() => changeTimer(selected.timeStartedAt ? "pause" : "start")}>{selected.timeStartedAt ? "Pause timer" : "Start / resume"}</button>
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
                  <label htmlFor="task-detail-description">Description</label>
                  <textarea
                    id="task-detail-description"
                    className="task-detail-description"
                    rows={12}
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
                    <label>Schedule start</label>
                    <input type="datetime-local" value={toLocalDateTimeInput(selected.startDate)} onChange={(e) => setSelected({ ...selected, startDate: e.target.value })}/>
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
                    onClick={() => openAttachment(item)}
                  >
                    <span>
                      <Paperclip size={14} />
                      <b>{item.originalName}</b>
                      <small>{Math.ceil(item.size / 1024)} KB</small>
                    </span>
                    {item.mimeType.startsWith("image/") || item.mimeType === "application/pdf" ? <Search size={15} /> : <Download size={15} />}
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
                      <strong className="comment-author">{c.author?.name || (() => { const person = members.find((m) => m.employeeId === c.authorEmployeeId)?.employee; return person ? `${person.firstName} ${person.lastName}` : "Team member"; })()}</strong>
                      <p>{c.body.split(/(@[\w-]+)/g).map((part, index) => part.startsWith("@") ? <mark className="comment-mention" key={`${part}-${index}`}>{part}</mark> : part)}</p>
                      <small>{new Date(c.createdAt).toLocaleString([], { hour12: true })}</small>
                    </div>
                  </article>
                ))}
                <form onSubmit={addComment}>
                  <div className="comment-composer">
                  <textarea
                    ref={commentInput}
                    required
                    rows={3}
                    placeholder="Write a comment… Use @ to mention a teammate"
                    value={comment}
                    onChange={(e) => changeComment(e.target.value, e.target.selectionStart)}
                  />
                  {mentionQuery !== null && <div className="mention-suggestions">{mentionSuggestions.length ? mentionSuggestions.map((member) => <button type="button" key={member.employeeId} onClick={() => insertMention(member)}><span className="avatar">{member.employee?.firstName?.[0]}{member.employee?.lastName?.[0]}</span><span><strong>{member.employee?.firstName} {member.employee?.lastName}</strong><small>@{member.employee?.employeeCode}</small></span></button>) : <p>No matching project member</p>}</div>}
                  </div>
                  <span className="comment-hint"><AtSign size={13}/> Type @ and choose a project member. They’ll receive a notification.</span>
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
