import type { Employee, ProjectReminder, ProjectTask, WorkflowStatus } from "@/types";
import type { TaskDetailData, TaskWorklog } from "@/types/taskDetails";
import type { DailyTask, DailyWorkspace } from "./dailyWorkspace";
import { upcomingDays, workspaceDay } from "./dailyWorkspace";

type Client = { get<T>(path: string): Promise<T> };
const statusCode = (error: unknown) => (error as { status?: number })?.status;

function midnight(day: string, timeZone: string) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const part = (name: string) => Number(parts.find((item) => item.type === name)!.value);
    const observed = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    const correction = target - observed;
    if (!correction) break;
    guess += correction;
  }
  return guess;
}

export async function loadDailyWorkspace(client: Client, timeZone: string, employeeId?: string): Promise<DailyWorkspace> {
  try {
    return await client.get<DailyWorkspace>(`/projects/my-day?timezone=${encodeURIComponent(timeZone)}`);
  } catch (error) {
    // Only a missing route uses compatibility reads. Authentication and service
    // failures must retain their normal handling, rather than silently falling back.
    if (statusCode(error) !== 404) throw error;
  }
  if (!employeeId) employeeId = (await client.get<{ employee: Employee }>("/employee/me")).employee.id;
  const now = new Date(), day = workspaceDay(now, timeZone), from = midnight(day, timeZone);
  const response = await client.get<{ tasks: ProjectTask[] }>("/projects/my-tasks");
  const assigned = response.tasks.filter((task) => task.project?.status !== "archived");
  const projects = new Map(assigned.map((task) => [task.projectId, task.project]));
  const statuses = new Map<string, WorkflowStatus>();
  const reminders: DailyWorkspace["reminders"] = [];
  const notices: string[] = [];
  await Promise.all([...projects].map(async ([projectId, project]) => {
    const result = await client.get<{ workflow: WorkflowStatus[] }>(`/projects/${projectId}/workflow`);
    result.workflow.forEach((status) => statuses.set(status.id, status));
    try {
      const result = await client.get<{ reminders: ProjectReminder[] }>(`/projects/${projectId}/reminders`);
      reminders.push(...result.reminders.filter((reminder) => {
        const reminderDay = workspaceDay(new Date(reminder.scheduledAt), timeZone);
        return upcomingDays(day).includes(reminderDay);
      }).map((reminder) => ({ ...reminder, project })));
    } catch (error) {
      if ([401, 403, 409].includes(statusCode(error) || 0)) throw error;
      if (!notices.includes("Project reminders could not be loaded.")) notices.push("Project reminders could not be loaded.");
    }
  }));
  const tasks: DailyTask[] = assigned.map((task) => ({
    id: task.id, key: task.key, title: task.title, projectId: task.projectId, project: task.project,
    status: statuses.get(task.workflowStatusId) || { name: "Unknown", category: "unknown" },
    priority: task.priority, startDate: task.startDate,
    startDay: task.startDate ? workspaceDay(new Date(task.startDate), timeZone) : undefined,
    dueDay: task.dueDate?.slice(0, 10), assigned: true, autoPaused: task.autoPaused,
    completedToday: !!task.completedAt && workspaceDay(new Date(task.completedAt), timeZone) === day,
    trackedSecondsToday: 0, runningForMe: false, timeAvailable: true,
  }));
  // A stopped session updates its task; a timer still running from a prior day
  // is also included. Do not load history for every old, untouched task.
  const recent = assigned.filter((task) => !!task.timeStartedAt && !task.timeStoppedAt || !!task.updatedAt && Date.parse(task.updatedAt) >= from || !!task.completedAt && Date.parse(task.completedAt) >= from);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, recent.length) }, async () => {
    while (cursor < recent.length) {
      const raw = recent[cursor++];
      const task = tasks.find((item) => item.id === raw.id)!;
      try {
        let detail = await client.get<TaskDetailData>(`/projects/${raw.projectId}/tasks/${raw.id}`);
        const logs: TaskWorklog[] = [...detail.worklog];
        for (let page = 2; detail.worklogPagination.hasMore && detail.worklog.length && Date.parse(detail.worklog[detail.worklog.length - 1].startedAt) >= from; page++) {
          detail = await client.get<TaskDetailData>(`/projects/${raw.projectId}/tasks/${raw.id}?worklogPage=${page}`);
          logs.push(...detail.worklog);
        }
        const seen = new Set<string>();
        for (const log of logs) {
          if (seen.has(log.id) || log.employee.id !== employeeId && log.employee.employeeId !== employeeId) continue;
          seen.add(log.id);
          const start = Math.max(from, Date.parse(log.startedAt));
          const end = Math.min(now.getTime(), log.endedAt ? Date.parse(log.endedAt) : now.getTime());
          task.trackedSecondsToday += Math.max(0, Math.floor((end - start) / 1000));
          if (!log.endedAt && start <= now.getTime()) task.runningForMe = true;
        }
      } catch (error) {
        if ([401, 403, 409].includes(statusCode(error) || 0)) throw error;
        task.timeAvailable = false;
      }
    }
  }));
  const timeAvailable = tasks.every((task) => task.timeAvailable);
  if (!timeAvailable) notices.push("Some task time logs could not be loaded. Retry to see today's complete time.");
  if (response.tasks.length >= 200) notices.push("This overview covers your first 200 assigned tasks.");
  const open = tasks.filter((task) => task.status.category !== "done");
  return {
    day, timeZone, serverNow: now.toISOString(), timeAvailable, notice: notices.join(" "), tasks, reminders,
    stats: {
      assigned: tasks.length, backlog: open.filter((task) => task.status.category === "todo").length,
      inProgress: open.filter((task) => task.status.category === "in_progress").length,
      paused: open.filter((task) => task.status.category === "paused").length,
      dueToday: open.filter((task) => task.dueDay === day).length,
      overdue: open.filter((task) => task.dueDay && task.dueDay < day).length,
      completedToday: tasks.filter((task) => task.status.category === "done" && task.completedToday).length,
      workedOnToday: tasks.filter((task) => task.trackedSecondsToday > 0 || task.runningForMe).length,
      trackedSecondsToday: tasks.reduce((sum, task) => sum + task.trackedSecondsToday, 0),
      runningTimers: tasks.filter((task) => task.runningForMe).length,
    },
  };
}
