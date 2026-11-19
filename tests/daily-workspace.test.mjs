import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const context = { exports: {}, Intl, Date };
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../lib/dailyWorkspace.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  context,
);
const { focusTasks, upcomingDays, calendarEvents, workspaceDay, workDuration } =
  context.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const day = "2026-11-19";
const task = (id, other = {}) => ({
  id,
  key: id,
  projectId: "project-1",
  title: id,
  status: { name: "Backlog", category: "todo" },
  assigned: true,
  completedToday: false,
  trackedSecondsToday: 0,
  runningForMe: false,
  priority: "medium",
  ...other,
});

test("today's focus combines scheduled, due, worked and running tasks without unrelated backlog", () => {
  const tasks = [
    task("later", { dueDay: "2026-11-21" }),
    task("worked", { trackedSecondsToday: 600, assigned: false }),
    task("due", { dueDay: day }),
    task("scheduled", { startDay: day }),
    task("running", { runningForMe: true }),
    task("done", {
      status: { name: "Done", category: "done" },
      completedToday: true,
    }),
    task("backlog"),
  ];
  const result = focusTasks(tasks, day, "today");
  assert.equal(result[0].id, "running");
  assert.deepEqual(plain(result.map((row) => row.id)).sort(), [
    "done",
    "due",
    "running",
    "scheduled",
    "worked",
  ]);
  assert.equal(tasks[0].id, "later", "sorting does not mutate incoming data");
});

test("status filters respect ownership and completion, including overdue and auto-paused tasks", () => {
  const tasks = [
    task("late", { dueDay: "2026-11-18" }),
    task("not-late", { dueDay: day }),
    task("done-old", {
      dueDay: "2026-11-18",
      status: { name: "Released", category: "done" },
    }),
    task("paused", {
      status: { name: "Pause", category: "paused" },
      autoPaused: true,
    }),
    task("other-person", { dueDay: "2026-11-18", assigned: false }),
    task("done-today", {
      status: { name: "Released", category: "done" },
      completedToday: true,
    }),
  ];
  assert.deepEqual(
    plain(focusTasks(tasks, day, "overdue").map((row) => row.id)),
    ["late"],
  );
  assert.deepEqual(
    plain(focusTasks(tasks, day, "paused").map((row) => row.id)),
    ["paused"],
  );
  assert.deepEqual(plain(focusTasks(tasks, day, "done").map((row) => row.id)), [
    "done-today",
  ]);
  assert.equal(focusTasks(tasks, day, "all").length, 3);
});

test("calendar preserves date-only deadlines and converts timed events into the employee's zone", () => {
  const data = {
    day,
    timeZone: "Asia/Karachi",
    tasks: [
      task("due", { dueDay: day }),
      task("start", {
        startDay: "2026-11-20",
        startDate: "2026-11-19T20:00:00Z",
      }),
      task("next-week", { dueDay: "2026-11-26" }),
      task("not-assigned", { dueDay: day, assigned: false }),
    ],
    reminders: [
      {
        id: "reminder-1",
        title: "Review",
        scheduledAt: "2026-11-19T20:00:00Z",
        project: { id: "project-1", name: "Project" },
      },
    ],
  };
  const events = calendarEvents(data);
  assert.equal(events.length, 3);
  assert.equal(events.find((row) => row.kind === "due").day, day);
  assert.equal(
    events.find((row) => row.kind === "due").at,
    undefined,
    "deadlines are all-day dates",
  );
  assert.equal(events.find((row) => row.kind === "reminder").day, "2026-11-20");
  assert.equal(
    workspaceDay(new Date("2026-11-19T20:00:00Z"), "Asia/Karachi"),
    "2026-11-20",
  );
});

test("calendar spans month and year boundaries and durations show hours plus minutes", () => {
  const days = plain(upcomingDays("2026-12-29"));
  assert.equal(days.length, 7);
  assert.equal(days[6], "2027-01-04");
  assert.equal(workDuration(5400), "1h 30m");
  assert.equal(workDuration(-30), "0h 0m");
});
