"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { loadDailyWorkspace } from "@/lib/loadDailyWorkspace";
import { errorMessage } from "@/lib/workspace";
import { taskDetailsHref } from "@/lib/taskLinks";
import {
  calendarEvents,
  focusTasks,
  upcomingDays,
  workDuration,
  workspaceDay,
} from "@/lib/dailyWorkspace";
import type {
  DailyWorkspace as Workspace,
  FocusFilter,
} from "@/lib/dailyWorkspace";

const filters: { value: FocusFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "in_progress", label: "In progress" },
  { value: "overdue", label: "Overdue" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done today" },
  { value: "all", label: "All open" },
];

export default function DailyWorkspace({ now }: { now: Date | null }) {
  const [zone, setZone] = useState("");
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<FocusFilter>("today");
  const [selectedDay, setSelectedDay] = useState("");
  const day = now && zone ? workspaceDay(now, zone) : "";
  useEffect(
    () => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
    [],
  );
  useEffect(() => {
    if (!day || !zone) return;
    let cancelled = false,
      busy = false;
    setData(null);
    setError("");
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const result = await loadDailyWorkspace(api, zone, getSession()?.employeeId);
        if (!cancelled) {
          setData(result);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        busy = false;
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    const timer = window.setInterval(visible, 30000);
    window.addEventListener("focus", visible);
    window.addEventListener("hrm:attendance-change", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("hrm:attendance-change", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [day, zone, refresh]);

  const days = day ? upcomingDays(day) : [];
  const selected = days.includes(selectedDay) ? selectedDay : day;
  const events = data ? calendarEvents(data) : [];
  const agenda = events.filter((event) => event.day === selected);
  const tasks = data ? focusTasks(data.tasks, data.day, filter) : [];
  // Polling replaces the snapshot; only the signed-in employee's running logs tick.
  const elapsed =
    data && now
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() - new Date(data.serverNow).getTime()) / 1000,
          ),
        )
      : 0;
  const stats = data?.stats;
  const tiles = [
    {
      label: "Due today",
      value: stats?.dueToday,
      note: "Open tasks due today",
      filter: "today" as FocusFilter,
    },
    {
      label: "In progress",
      value: stats?.inProgress,
      note: `${stats?.backlog ?? "—"} waiting in backlog`,
      filter: "in_progress" as FocusFilter,
    },
    {
      label: "Overdue",
      value: stats?.overdue,
      note: "Needs your attention",
      filter: "overdue" as FocusFilter,
    },
    {
      label: "Paused",
      value: stats?.paused,
      note: "On hold or duration reached",
      filter: "paused" as FocusFilter,
    },
    {
      label: "Done today",
      value: stats?.completedToday,
      note: "Completed tasks assigned to you",
      filter: "done" as FocusFilter,
    },
  ];
  const clock = (at: string) =>
    new Date(at).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: zone,
    });

  return (
    <section className="daily-workspace" aria-label="Your daily work">
      {error && (
        <div className="daily-error" role="alert">
          <span>
            {data
              ? "This view may be out of date. "
              : "Your task overview could not be loaded. "}
            {error}
          </span>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {data?.notice && <p className="daily-data-note" role="status">{data.notice}</p>}
      <div
        className="daily-metrics"
        aria-label="Task summary"
        aria-busy={!data && !error}
      >
        <article className="daily-metric daily-time">
          <span>Task time today</span>
          <strong>
            {stats && data?.timeAvailable !== false
              ? workDuration(
                  stats.trackedSecondsToday + elapsed * stats.runningTimers,
                )
              : "—"}
          </strong>
          <small>
            {stats && data?.timeAvailable !== false
              ? `${stats.workedOnToday} tasks worked on · ${stats.runningTimers} timers running`
              : error || data?.timeAvailable === false
                ? "Unavailable"
                : "Loading your work…"}
          </small>
        </article>
        {tiles.map(({ label, value, note, filter: view }) => (
          <button
            type="button"
            key={label}
            className={`daily-metric ${label === "Overdue" && value ? "needs-attention" : ""}`}
            onClick={() => setFilter(view)}
            disabled={!data}
            aria-label={`${label}: ${value ?? "unavailable"}. Filter tasks`}
          >
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
            <small>{note}</small>
          </button>
        ))}
      </div>
      <div className="daily-panels">
        <section className="card daily-tasks">
          <header className="daily-panel-header">
            <div>
              <h2>Tasks</h2>
              <p>
                {data
                  ? `${stats!.assigned} assigned tasks across your projects`
                  : "Tasks, priorities, and today's tracked time"}
              </p>
            </div>
            <Link href="/projects/my-tasks" className="button button-secondary">
              All my tasks
            </Link>
          </header>
          <div className="daily-filters" aria-label="Filter your tasks">
            {filters.map((item) => (
              <button
                type="button"
                key={item.value}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="daily-task-list">
            {!data ? (
              <div className="daily-empty" role="status">
                <strong>
                  {error ? "Tasks unavailable" : "Loading your tasks…"}
                </strong>
                <p>
                  {error
                    ? "Retry to see your task progress."
                    : "Getting your latest work."}
                </p>
              </div>
            ) : !tasks.length ? (
              <div className="daily-empty">
                <strong>
                  {filter === "today"
                    ? "Your day is clear"
                    : "No tasks in this view"}
                </strong>
                <p>
                  {filter === "today"
                    ? "Scheduled work, tasks due today, and tasks you work on today appear here."
                    : "Switch filters to explore your other assigned tasks."}
                </p>
                <button
                  type="button"
                  onClick={() => setFilter(filter === "all" ? "today" : "all")}
                  className="button button-secondary"
                >
                  {filter === "all" ? "See today" : "See all open tasks"}
                </button>
              </div>
            ) : (
              tasks.map((task) => (
                <Link
                  href={taskDetailsHref(task.projectId, task.id)}
                  className="daily-task-row"
                  key={task.id}
                >
                  <div className="daily-task-copy">
                    <span>
                      {task.key} · {task.project?.name || "Project"}
                    </span>
                    <strong>{task.title}</strong>
                    <div>
                      <span className="daily-status">
                        {task.autoPaused
                          ? "Automatically paused"
                          : task.status.name}
                      </span>
                      <span
                        className={`daily-priority priority-${task.priority}`}
                      >
                        {task.priority}
                      </span>
                      {task.dueDay && (
                        <span
                          className={
                            task.dueDay < day && task.status.category !== "done"
                              ? "daily-overdue"
                              : ""
                          }
                        >
                          {task.dueDay === day
                            ? "Due today"
                            : `Due ${new Date(`${task.dueDay}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="daily-task-time">
                    <strong>
                      {task.timeAvailable === false ? "—" : workDuration(
                        task.trackedSecondsToday +
                          (task.runningForMe ? elapsed : 0),
                      )}
                    </strong>
                    <span>{task.runningForMe ? "Running now" : "Today"}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
        <section
          className="card daily-calendar"
          aria-label="Your seven day calendar"
        >
          <header className="daily-panel-header">
            <div>
              <h2>Calendar</h2>
              <p>Next 7 days · {zone?.replaceAll("_", " ") || "Local time"}</p>
            </div>
          </header>
          <div className="daily-week" aria-label="Choose a calendar day">
            {days.map((date) => (
              <button
                type="button"
                key={date}
                className={`${date === selected ? "selected" : ""} ${date === day ? "is-today" : ""}`}
                aria-pressed={date === selected}
                aria-label={`${date}${date === day ? ", today" : ""}, ${events.filter((event) => event.day === date).length} events`}
                onClick={() => setSelectedDay(date)}
              >
                <span>
                  {new Date(`${date}T12:00:00`).toLocaleDateString([], {
                    weekday: "short",
                  })}
                </span>
                <strong>{Number(date.slice(-2))}</strong>
                <small>
                  {events.filter((event) => event.day === date).length || "·"}
                </small>
              </button>
            ))}
          </div>
          <div className="daily-agenda-header">
            <strong>
              {selected === day
                ? "Today"
                : selected &&
                  new Date(`${selected}T12:00:00`).toLocaleDateString([], {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
            </strong>
            <span>{data ? `${agenda.length} scheduled items` : "—"}</span>
          </div>
          <div className="daily-agenda">
            {!data ? (
              <div className="daily-empty">
                <strong>
                  {error ? "Calendar unavailable" : "Loading your schedule…"}
                </strong>
              </div>
            ) : !agenda.length ? (
              <div className="daily-empty">
                <strong>Nothing scheduled</strong>
                <p>
                  Task starts, due dates, and project reminders will appear
                  here.
                </p>
                <Link href="/projects" className="button button-secondary">
                  Open projects
                </Link>
              </div>
            ) : (
              agenda.map((event) => (
                <Link
                  key={event.id}
                  className={`daily-event event-${event.kind}`}
                  href={
                    event.taskId && event.projectId
                      ? taskDetailsHref(event.projectId, event.taskId)
                      : `/projects/${event.projectId}?view=calendar`
                  }
                >
                  <time>{event.at ? clock(event.at) : "All day"}</time>
                  <div>
                    <span>
                      {event.done
                        ? "Completed"
                        : event.kind === "due"
                          ? "Task due"
                          : event.kind === "start"
                            ? "Scheduled start"
                            : "Project reminder"}
                    </span>
                    <strong>{event.title}</strong>
                    <small>{event.project}</small>
                  </div>
                </Link>
              ))
            )}
          </div>
          <footer className="daily-calendar-footer">
            Select a day to see its schedule. Open any task to view details.
          </footer>
        </section>
      </div>
    </section>
  );
}
