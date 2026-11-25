"use client";
import { Calendar, CheckSquare2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { EmptyState, ErrorBanner, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { ProjectTask } from "@/types";
import { taskDetailsHref } from "@/lib/taskLinks";
export default function MyTasks() {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<{ tasks: ProjectTask[] }>("/projects/my-tasks")
      .then((data) => setTasks(data.tasks || []))
      .catch((error) => setError(error instanceof ApiError ? error.message : "Could not load assigned work"))
      .finally(() => setLoading(false));
  }, []);

  const groups = new Map<string, ProjectTask[]>();
  for (const task of tasks) {
    const date = (task.startDate || task.dueDate)?.slice(0, 10) ?? "";
    const group = groups.get(date) ?? [];
    group.push(task);
    groups.set(date, group);
  }
  const days = [...groups].sort(([a], [b]) => (a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0));

  return <AppShell>
    <PageHeader eyebrow="My work" title="Assigned tasks" description="Shared project work currently assigned to you." />
    {error && <ErrorBanner message={error} />}
    <section className="card">
      {loading && <div className="loading-line" />}
      {!loading && !tasks.length && <EmptyState title="Nothing assigned" description="Tasks assigned to you will appear here." />}
      {days.map(([date, rows]) => <section key={date}>
        <h3>{date ? new Date(`${date}T00:00:00`).toLocaleDateString([], { dateStyle: "full" }) : "Unscheduled"}</h3>
        <div className="my-task-list">{rows.map((task) => <Link key={task.id} href={taskDetailsHref(task.projectId, task.id)}>
          <span className={`issue-type type-${task.type}`}>{task.type}</span>
          <div><strong>{task.title}</strong><small>{task.project?.name} · {task.key}</small></div>
          <span className={`priority priority-${task.priority}`}>{task.priority}</span>
          <time><Calendar size={13} />{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}</time>
          <CheckSquare2 size={17} />
        </Link>)}</div>
      </section>)}
    </section>
  </AppShell>;
}
