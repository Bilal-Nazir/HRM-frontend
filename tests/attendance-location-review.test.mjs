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
  const scope = { exports: {}, Date, require: (name) => name in mocks ? mocks[name] : require(name) };
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, scope);
  return scope.exports;
}
const row = { id: "request-1", action: "check_in", status: "pending", active: true, latitude: 33.7, longitude: 73, reason: "Laptop cannot determine location", requestedAt: "2026-11-10T04:00:00Z", employeeName: "Alex Example" };
const ui = { ErrorBanner: ({ message }) => React.createElement("p", {}, message), StatusPill: ({ value }) => React.createElement("span", {}, value) };
function renderReview({ admin = false, assistance = true, open = false, requests = [row] } = {}) {
  let state = 0;
  const hooks = { ...React, useState: (value) => React.useState(state++ === 2 ? open : value) };
  const component = load("components/AttendanceLocationReview.tsx", { react: hooks, "@/lib/api": {}, "@/lib/useLiveData": { useLiveData: () => ({ data: { requests, page: 1, lastPage: 1 }, refresh() {} }) }, "@/lib/attendanceGeolocation": {}, "@/lib/workspace": {}, "@/components/ui": ui }).default;
  return renderToStaticMarkup(React.createElement(component, { admin, assistance }));
}

test("employee assistance requires a map pin and explains that a request alone does not record attendance", () => {
  const html = renderReview({ open: true });
  for (const label of ["Location is required", "Send location to admin", "Copy phone link", "Location coordinates or full Maps link", "Sending a pin alone does not record attendance", "Retry this device"]) assert.ok(html.includes(label), label);
  assert.match(html, /<input required/); assert.match(html, /Cancel request/);
  assert.doesNotMatch(html, /Confirm location &amp; record attendance/);
});

test("admin inbox provides the proposed pin, editable confirmation and explicit approval time", () => {
  const html = renderReview({ admin: true });
  for (const label of ["Attendance location requests", "Alex Example", "View proposed pin", "33.7, 73", "Confirm or correct location", "Approval records the attendance time now", "Confirm location &amp; record attendance", "Reject"]) assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /Send location to admin|Copy phone link|Cancel request/);
});

test("day records distinguish manually entered points from browser readings and missing historical points", () => {
  const report = load("lib/attendanceReport.ts");
  const component = load("components/AttendanceDayRecords.tsx", { "@/lib/attendanceReport": report, "@/components/AttendanceDevices": { __esModule: true, default: () => null }, "@/components/CorrectAttendanceLocation": { __esModule: true, default: () => null } }).default;
  const html = renderToStaticMarkup(React.createElement(component, { sessions: [{ id: "session", workDate: "2026-11-10", checkInAt: "2026-11-10T04:00:00Z", checkOutAt: "2026-11-10T05:00:00Z", checkInLocation: { latitude: 33.7, longitude: 73, source: "admin", reason: "Confirmed with employee" }, checkOutLocation: { latitude: 33.7, longitude: 73, source: "browser", accuracyMeters: 80 }, workedHours: 1, flags: [] }] }));
  assert.match(html, /Admin-entered location/); assert.match(html, /Browser accuracy ±80 m/);
  assert.match(html, /https:\/\/www.google.com\/maps\?q=33.7,73/); assert.match(html, /Confirmed with employee/);
});
