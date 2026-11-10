import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const scope = { exports: {}, Date, URLSearchParams, require: (name) => name in mocks ? mocks[name] : require(name) };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, scope);
  return scope.exports;
}
const links = load("lib/taskLinks.ts");
const projectId = "6ae98f9c779ddf809548ee0a", taskId = "6ae98f07779ddf809548edab";
const path = `/projects/${projectId}/tasks/${taskId}`;
const Link = ({ children, ...props }) => React.createElement("a", props, children);
const activity = load("components/TaskActivity.tsx", { "next/link": { __esModule: true, default: Link } });
const person = { id: "employee-1", employeeId: "employee-1", name: "Alex Example" };
const data = {
  task: { id: taskId, projectId, key: "PR-1", title: "Task detail example", type: "task", description: "A long and readable description.", creator: person, reporter: person, assignees: [], assigneeEmployeeIds: [], priority: "medium", labels: ["frontend"], workflowStatusId: "status-1", status: { name: "Backlog" }, createdAt: "2026-11-05T08:00:00Z", updatedAt: "2026-11-05T10:00:00Z", accumulatedSeconds: 600 },
  project: { id: projectId, name: "Project", key: "PR", status: "active" }, permissions: { canEdit: true }, workflow: [{ id: "status-1", name: "Backlog" }], children: [], attachments: [],
  activity: [{ id: "a", actor: person, action: "task.status_changed", createdAt: "2026-11-05T08:00:00Z", fieldChanges: [{ field: "status", label: "Status", before: "Backlog", after: "In Progress" }] }, { id: "b", actor: person, action: "comment.added", createdAt: "2026-11-05T09:00:00Z", fieldChanges: [] }],
  comments: [{ id: "c", author: person, body: "@E-1 Please review <script>example</script>", createdAt: "2026-11-05T09:00:00Z", mentions: [] }],
  worklog: [{ id: "w", employee: person, startedAt: "2026-11-05T09:00:00Z", endedAt: "2026-11-05T09:10:00Z", durationSeconds: 600, stopReason: "checkout" }],
  worklogSummary: { trackedSeconds: 600, legacySeconds: 0, sessionCount: 1 }, activityPagination: { page: 1, hasMore: true }, worklogPagination: { page: 1, hasMore: false },
};

test("old notification board links resolve to the exact task and comments tab for each portal", () => {
  const old = { href: `/projects/${projectId}/board`, projectId, taskId, type: "project.comment_mentioned" };
  assert.equal(links.notificationHref(old, false), `${path}?activity=comments`);
  assert.equal(links.notificationHref(old, true), `/admin${path}?activity=comments`);
  assert.equal(links.notificationHref({ ...old, type: "project.task_due_soon" }, true), `/admin${path}`);
});

test("task return paths preserve the task and tab across portals and reject external destinations", () => {
  assert.equal(links.taskReturnPath(`/admin${path}?activity=history`, false), `${path}?activity=history`);
  assert.equal(links.taskReturnPath(`${path}?activity=worklog`, true), `/admin${path}?activity=worklog`);
  for (const unsafe of ["https://example.com", "//example.com", "/admin/dashboard", `${path}/extra`, `/projects/%2fexample/tasks/${taskId}`]) assert.equal(links.taskReturnPath(unsafe, true), null);
  assert.equal(links.taskReturnPath(`${path}?activity=invalid`, false), path);
});

test("activity tabs isolate comments, field changes and work logs; All includes each once", () => {
  const render = (tab, admin = true) => renderToStaticMarkup(React.createElement(activity.default, { data, tab, admin, now: null }));
  const history = render("history"); assert.match(history, /Backlog/); assert.match(history, /In Progress/); assert.doesNotMatch(history, /Please review/);
  const comments = render("comments"); assert.match(comments, /Please review/); assert.doesNotMatch(comments, /<script>/); assert.doesNotMatch(comments, /changed the status/);
  const worklog = render("worklog"); assert.match(worklog, /0h 10m 0s/); assert.match(worklog, /Stopped automatically at check-out/); assert.doesNotMatch(worklog, /Please review/);
  const all = render("all"); assert.equal((all.match(/Please review/g) || []).length, 1); assert.match(all, /logged time/); assert.doesNotMatch(all, /added a comment/);
  assert.match(history, /href="\/admin\/employees\/employee-1"/); assert.doesNotMatch(render("history", false), /\/admin\/employees/);
});

function renderDetails({ canEdit = true, tab = "all", admin = true, taskChanges = {} } = {}) {
  let stateIndex = 0;
  const state = [ { ...data, task: { ...data.task, ...taskChanges }, permissions: { canEdit } }, [], false ];
  const hooks = { ...React, useState: (initial) => [stateIndex < state.length ? state[stateIndex++] : (stateIndex++, initial), () => {}], useEffect: () => {}, useCallback: (fn) => fn, useRef: (value) => ({ current: value }) };
  const component = load("components/TaskDetails.tsx", {
    react: hooks, "next/link": { __esModule: true, default: Link },
    "next/navigation": { useParams: () => ({ projectId, taskId }), usePathname: () => `${admin ? "/admin" : ""}${path}`, useSearchParams: () => new URLSearchParams({ activity: tab }), useRouter: () => ({}) },
    "@/components/AppShell": { __esModule: true, default: ({ children }) => React.createElement("div", {}, children) },
    "@/components/ui": { ErrorBanner: () => null }, "@/components/TaskActivity": activity,
    "@/components/TaskDurationSelect": load("components/TaskDurationSelect.tsx", { "@/lib/taskDuration": load("lib/taskDuration.ts") }), "@/lib/taskDuration": load("lib/taskDuration.ts"),
    "@/lib/api": {}, "@/lib/taskLinks": links, "@/lib/useClientClock": { useClientClock: () => null },
  }).default;
  return renderToStaticMarkup(React.createElement(component));
}

test("task page exposes task metadata and bottom activity tabs, with read-only mode for viewers", () => {
  const html = renderDetails();
  for (const label of ["Created by", "Reporter", "Created", "Updated", "Scheduled start", "Due date", "Task duration", "Total tracked", "Unassigned", "Description", "History", "Work log", "Copy link"]) assert.ok(html.includes(label), label);
  assert.ok(html.indexOf('id="activity"') > html.indexOf("task-detail-sidebar"));
  assert.match(html, /Edit task/); assert.match(html, /Add comment/); assert.match(html, /Load older activity/);
  const viewer = renderDetails({ canEdit: false, tab: "history" });
  assert.doesNotMatch(viewer, /Edit task|Add comment|Start \/ resume/); assert.match(viewer, /aria-label="Task status" disabled/);
});

test("automatically completed tasks show Auto done and cannot restart their timer from the detail screen", () => {
  const html = renderDetails({ taskChanges: { durationMinutes: 30, completionMethod: "auto", completedAt: "2026-11-10T10:00:00Z", timeStoppedAt: "2026-11-10T10:00:00Z", accumulatedSeconds: 1800 } });
  assert.match(html, /Auto done/); assert.match(html, /Task duration/); assert.match(html, /30min/);
  assert.doesNotMatch(html, /Start \/ resume|Pause timer/);
  const manual = renderDetails({ taskChanges: { completionMethod: "manual", completedAt: "2026-11-10T10:00:00Z" } });
  assert.match(manual, /Manual completion/); assert.doesNotMatch(manual, /Auto done/);
});
