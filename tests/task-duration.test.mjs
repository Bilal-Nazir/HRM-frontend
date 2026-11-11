import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const load = (file, mocks = {}) => {
  const context = { exports: {}, require: (name) => mocks[name] || require(name) };
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, context);
  return context.exports;
};
const duration = load("lib/taskDuration.ts");
const Select = load("components/TaskDurationSelect.tsx", { "@/lib/taskDuration": duration }).default;

test("duration picker offers configured choices and preserves a removed existing selection", () => {
  const html = renderToStaticMarkup(React.createElement(Select, { options: [30, 60, 240], value: "45", onChange() {} }));
  for (const value of ['value="30"', 'value="60"', 'value="240"', "30min", "1h", "4h", "45min (existing selection)"]) assert.ok(html.includes(value), value);
  assert.match(html, /<select[^>]*required/); assert.match(html, /<option value="" disabled="" hidden="">Select duration/);
  assert.doesNotMatch(html, /No automatic completion|type="number"/);
  const noOptions = renderToStaticMarkup(React.createElement(Select, { options: [], value: "", onChange() {} }));
  assert.match(noOptions, /No durations configured/); assert.match(noOptions, /<select[^>]*required/);
});

test("admin settings show duration choices and the fixed Pause destination with admin release rules", () => {
  const Settings = load("components/TaskDurationSettings.tsx", { "@/lib/taskDuration": duration, "@/lib/api": {}, "@/components/ui": { ErrorBanner: () => null } }).default;
  const html = renderToStaticMarkup(React.createElement(Settings, { project: { id: "project", taskDurationOptionsMinutes: [30, 60, 240], autoCompleteStatusId: "done" }, workflow: [{ id: "backlog", name: "Backlog", category: "todo" }, { id: "progress", name: "In Progress", category: "in_progress" }, { id: "done", name: "Ready for delivery", category: "done" }], onSaved() {} }));
  for (const value of ["Minutes", "Hours", "Days", "30min", "1h", "4h", "Pause", "Only an admin", "increase its duration", "Save duration settings"]) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /Completion column|Auto done|Ready for delivery/);
});
