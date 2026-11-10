import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const context = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/projectPreferences.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { projectView, projectFilterKey, readProjectFilters, writeProjectFilters } = context.exports;
const bn = "6ae98f9c779ddf809548ee0a", ma = "6ae98f07779ddf809548edab";
const user = { userId: "user-1", organizationId: "org-1" };
const memory = () => { const values = new Map(); return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; };
const plain = (value) => JSON.parse(JSON.stringify(value));

test("returning to a project without URL filters restores the chosen assignee, search and priority", () => {
  const storage = memory(), key = projectFilterKey(user, "project-1");
  const filters = { assignee: bn, search: "payment", priority: "high" };
  writeProjectFilters(storage, key, filters);
  assert.deepEqual(plain(readProjectFilters(storage, key, null)), filters);
  // Opening the Board, Tasks or Calendar tab without an explicit assignee
  // must preserve the saved selection across route remounts and reloads.
  for (const view of ["board", "tasks", "calendar"]) {
    const query = new URLSearchParams({ view });
    assert.equal(readProjectFilters(storage, key, query.get("assignee")).assignee, bn);
  }
});

test("All is an explicit saved choice and never resurrects the previous assignee", () => {
  const storage = memory(), key = projectFilterKey(user, "project-1");
  writeProjectFilters(storage, key, { assignee: bn, search: "", priority: "" });
  const cleared = readProjectFilters(storage, key, "all");
  writeProjectFilters(storage, key, cleared);
  assert.equal(readProjectFilters(storage, key, null).assignee, "");
  assert.equal(readProjectFilters(storage, key, "").assignee, "");
});

test("explicit assignee links override the saved selection without clearing other filters", () => {
  const storage = memory(), key = projectFilterKey(user, "project-1");
  writeProjectFilters(storage, key, { assignee: bn, search: "api", priority: "medium" });
  const selected = readProjectFilters(storage, key, ma);
  assert.deepEqual(plain(selected), { assignee: ma, search: "api", priority: "medium" });
  writeProjectFilters(storage, key, selected);
  assert.equal(readProjectFilters(storage, key, null).assignee, ma);
});

test("preferences are isolated between projects, employees and organizations", () => {
  const storage = memory(), key = projectFilterKey(user, "project-1");
  writeProjectFilters(storage, key, { assignee: bn, search: "api", priority: "low" });
  for (const other of [projectFilterKey(user, "project-2"), projectFilterKey({ ...user, userId: "user-2" }, "project-1"), projectFilterKey({ ...user, organizationId: "org-2" }, "project-1")]) {
    assert.notEqual(other, key);
    assert.deepEqual(plain(readProjectFilters(storage, other, null)), { assignee: "", search: "", priority: "" });
  }
  assert.equal(projectFilterKey(null, "project-1"), null);
});

test("malformed or unavailable storage does not prevent using the project", () => {
  for (const value of ["broken JSON", "null", JSON.stringify({ assignee: "bad-id", priority: "invalid", search: 12 })]) {
    assert.deepEqual(plain(readProjectFilters({ getItem: () => value }, "key", null)), { assignee: "", search: "", priority: "" });
  }
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(readProjectFilters(blocked, "key", bn).assignee, bn);
  assert.doesNotThrow(() => writeProjectFilters(blocked, "key", { assignee: bn, search: "", priority: "" }));
  const storage = memory(); writeProjectFilters(storage, "key", { assignee: bn, search: "", priority: "" });
  assert.equal(readProjectFilters(storage, "key", "bad-id").assignee, bn);
});

test("Board is the default project view while explicitly selected tabs remain accessible", () => {
  for (const path of ["/projects/project-1", "/admin/projects/project-1"]) {
    assert.equal(projectView(path, null, true), "board");
    assert.equal(projectView(path, "invalid", true), "board");
    assert.equal(projectView(path, "overview", true), "overview");
    assert.equal(projectView(path, "calendar", true), "calendar");
  }
  assert.equal(projectView("/admin/projects/project-1/workflow", null, true), "workflow");
  assert.equal(projectView("/projects/project-1/board", "tasks", false), "tasks");
  assert.equal(projectView("/projects/project-1", "workflow", false), "board");
});
