export type ProjectView = "overview" | "board" | "tasks" | "calendar" | "members" | "workflow" | "activity" | "trash";
export type ProjectFilters = { search: string; priority: string; assignee: string };
const views: ProjectView[] = ["overview", "board", "tasks", "calendar", "members", "workflow", "activity", "trash"];
const priorities = ["low", "medium", "high", "critical"];
const validAssignee = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
export const emptyProjectFilters = (): ProjectFilters => ({ search: "", priority: "", assignee: "" });

export function projectView(pathname: string, requested: string | null, admin: boolean): ProjectView {
  const allowed = (value: string | null | undefined): value is ProjectView => views.includes(value as ProjectView) && (admin || value !== "workflow");
  if (allowed(requested)) return requested;
  const route = pathname.split("/").pop();
  return allowed(route) ? route : "board";
}

export function projectFilterKey(user: { userId: string; organizationId?: string } | null, projectId: string): string | null {
  return user?.userId ? `hrm_project_filters:${user.organizationId || "platform"}:${user.userId}:${projectId}` : null;
}

export function normalizeProjectFilters(value: unknown): ProjectFilters {
  const filters = value && typeof value === "object" ? value as Partial<ProjectFilters> : {};
  return {
    search: typeof filters.search === "string" ? filters.search : "",
    priority: priorities.includes(filters.priority || "") ? filters.priority! : "",
    assignee: validAssignee(filters.assignee) ? filters.assignee : "",
  };
}

export function readProjectFilters(storage: Pick<Storage, "getItem">, key: string | null, requestedAssignee: string | null): ProjectFilters {
  let filters = emptyProjectFilters();
  try { if (key) filters = normalizeProjectFilters(JSON.parse(storage.getItem(key) || "null")); } catch { /* Storage may be blocked or contain an older value. */ }
  // An explicit URL selection wins. An absent parameter restores the saved
  // choice; "all" records a deliberate clear instead of resurrecting it.
  if (requestedAssignee === "all" || requestedAssignee === "") filters.assignee = "";
  else if (validAssignee(requestedAssignee)) filters.assignee = requestedAssignee;
  return filters;
}

export function writeProjectFilters(storage: Pick<Storage, "setItem">, key: string | null, filters: ProjectFilters) {
  try { if (key) storage.setItem(key, JSON.stringify(normalizeProjectFilters(filters))); } catch { /* Filtering still works when storage is unavailable. */ }
}
