export type TaskActivityTab = "all" | "comments" | "history" | "worklog";

export function taskDetailsHref(projectId: string, taskId: string, admin = false, activity?: TaskActivityTab) {
  return `${admin ? "/admin" : ""}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}${activity ? `?activity=${activity}` : ""}`;
}

// Only known internal detail and chat routes may be post-login destinations.
export function taskReturnPath(value: string | null, admin: boolean): string | null {
  if (!value) return null;
  const request = value.match(/^\/(?:admin\/)?leave\/([a-f0-9]{24})$/i);
  if (request) return `${admin ? "/admin" : ""}/leave/${request[1]}`;
  const chat = value.match(/^\/(?:admin\/)?chat(?:\?([^#]*))?$/i);
  if (chat) {
    const query = new URLSearchParams(chat[1]), safe = new URLSearchParams();
    for (const key of ["conversation", "project", "message"]) { const id = query.get(key); if (id && /^[a-f0-9]{24}$/i.test(id)) safe.set(key, id); }
    if (query.get("mentions") === "1") safe.set("mentions", "1");
    if (query.get("new") === "1") safe.set("new", "1");
    return `${admin ? "/admin" : ""}/chat${safe.size ? `?${safe}` : ""}`;
  }
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
  if (["/companies", "/join"].some((path) => href === path || href.startsWith(`${path}?`))) return href;
  if (!admin) return href.replace(/^\/admin(?=\/|$)/, "") || "/dashboard";
  return /^\/admin(?:\/|$)/.test(href) ? href : `/admin${href}`;
}
