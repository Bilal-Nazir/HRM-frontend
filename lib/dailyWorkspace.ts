export type DailyTask = {
  id: string;
  key: string;
  title: string;
  projectId: string;
  project?: { id: string; name: string; key: string };
  status: { name: string; category: string };
  priority: string;
  startDate?: string;
  startDay?: string;
  dueDay?: string;
  assigned: boolean;
  completedToday: boolean;
  autoPaused?: boolean;
  trackedSecondsToday: number;
  runningForMe: boolean;
  timeAvailable?: boolean;
};
export type DailyWorkspace = {
  day: string;
  timeZone: string;
  serverNow: string;
  timeAvailable?: boolean;
  notice?: string;
  stats: {
    assigned: number;
    backlog: number;
    inProgress: number;
    paused: number;
    dueToday: number;
    overdue: number;
    completedToday: number;
    workedOnToday: number;
    trackedSecondsToday: number;
    runningTimers: number;
  };
  tasks: DailyTask[];
  reminders: {
    id: string;
    title: string;
    scheduledAt: string;
    project?: { id: string; name: string };
  }[];
};
export type FocusFilter =
  "today" | "in_progress" | "paused" | "overdue" | "done" | "all";
export type DayEvent = {
  id: string;
  day: string;
  title: string;
  project?: string;
  projectId?: string;
  taskId?: string;
  kind: "start" | "due" | "reminder";
  at?: string;
  done?: boolean;
};

export function workspaceDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((name) => parts.find((part) => part.type === name)!.value)
    .join("-");
}

export function upcomingDays(day: string) {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
}

export function focusTasks(
  tasks: DailyTask[],
  day: string,
  filter: FocusFilter,
) {
  return tasks
    .filter((task) => {
      const open = task.status.category !== "done";
      if (filter === "today")
        return (
          task.runningForMe ||
          task.trackedSecondsToday > 0 ||
          task.completedToday ||
          (task.assigned &&
            open &&
            (task.dueDay === day || task.startDay === day))
        );
      if (filter === "overdue")
        return task.assigned && open && !!task.dueDay && task.dueDay < day;
      if (filter === "done")
        return task.assigned && !open && task.completedToday;
      if (filter === "all") return task.assigned && open;
      return task.assigned && task.status.category === filter;
    })
    .sort(
      (a, b) =>
        Number(b.runningForMe) - Number(a.runningForMe) ||
        Number(a.status.category === "done") -
          Number(b.status.category === "done") ||
        (a.dueDay || "9999").localeCompare(b.dueDay || "9999") ||
        a.title.localeCompare(b.title),
    );
}

export function calendarEvents(data: DailyWorkspace): DayEvent[] {
  const days = upcomingDays(data.day);
  const events: DayEvent[] = [];
  for (const task of data.tasks.filter((task) => task.assigned)) {
    if (task.dueDay && days.includes(task.dueDay))
      events.push({
        id: `due-${task.id}`,
        day: task.dueDay,
        title: task.title,
        project: task.project?.name,
        projectId: task.projectId,
        taskId: task.id,
        kind: "due",
        done: task.status.category === "done",
      });
    if (
      task.startDay &&
      days.includes(task.startDay) &&
      task.status.category !== "done"
    )
      events.push({
        id: `start-${task.id}`,
        day: task.startDay,
        title: task.title,
        project: task.project?.name,
        projectId: task.projectId,
        taskId: task.id,
        kind: "start",
        at: task.startDate,
      });
  }
  for (const reminder of data.reminders) {
    const day = workspaceDay(new Date(reminder.scheduledAt), data.timeZone);
    if (days.includes(day))
      events.push({
        id: `reminder-${reminder.id}`,
        day,
        title: reminder.title,
        project: reminder.project?.name,
        projectId: reminder.project?.id,
        kind: "reminder",
        at: reminder.scheduledAt,
      });
  }
  return events.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (a.at || "").localeCompare(b.at || "") ||
      a.title.localeCompare(b.title),
  );
}

export function workDuration(seconds: number) {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
