export type TaskActivityTab = "all" | "comments" | "history" | "worklog";

export function taskDetailsHref(projectId: string, taskId: string, admin = false, activity?: TaskActivityTab) {
  return `${admin ? "/admin" : ""}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}${activity ? `?activity=${activity}` : ""}`;
}

// Only internal task pages may be used as a post-login return destination.
export function taskReturnPath(value: string | null, admin: boolean): string | null {
  if (!value) return null;
  const match = value.match(/^\/(?:admin\/)?projects\/([a-f0-9]{24})\/tasks\/([a-f0-9]{24})(?:\?([^#]*))?(?:#activity)?$/i);
  if (!match) return null;
  const requested = new URLSearchParams(match[3]).get("activity");
  const activity = ["all", "comments", "history", "worklog"].includes(requested || "") ? requested as TaskActivityTab : undefined;
  return taskDetailsHref(match[1], match[2], admin, activity);
}

export function notificationHref(notification: { href: string; projectId?: string; taskId?: string; type: string }, admin: boolean) {
  if (notification.projectId && notification.taskId) return taskDetailsHref(notification.projectId, notification.taskId, admin, notification.type.includes("comment") ? "comments" : undefined);
  const href = notification.href;
  if (!href.startsWith("/") || href.startsWith("//")) return admin ? "/admin" : "/dashboard";
  return admin && !href.startsWith("/admin") ? `/admin${href}` : href;
}
