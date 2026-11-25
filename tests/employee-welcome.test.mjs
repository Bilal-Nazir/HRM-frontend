import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const scope = {
    exports: {},
    Date,
    Intl,
    require(name) {
      if (name in mocks) return mocks[name];
      return require(name);
    },
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      },
    ).outputText,
    scope,
  );
  return scope.exports;
}
const { attendanceClock } = load("lib/attendanceClock.ts");
test("the session clock shows seconds, survives midnight and does not wrap long sessions", () => {
  assert.equal(
    attendanceClock("2026-11-18T23:59:50Z", new Date("2026-11-19T00:00:03Z")),
    "00:00:13",
  );
  assert.equal(
    attendanceClock("2026-11-18T01:00:00Z", new Date("2026-11-19T03:02:03Z")),
    "26:02:03",
  );
  assert.equal(attendanceClock(undefined, new Date()), "00:00:00");
  assert.equal(attendanceClock("invalid", new Date()), "—");
  assert.equal(
    attendanceClock("2026-11-20T00:00:00Z", new Date("2026-11-19T00:00:00Z")),
    "00:00:00",
  );
});

test("the compact welcome shows a Quranic quote and active session duration instead of local time", () => {
  for (const active of [true, false]) {
    const now = new Date("2026-11-19T06:02:03Z");
    const session = {
      id: "session",
      checkInAt: "2026-11-19T04:00:00Z",
      workDate: "2026-11-19",
      status: active ? "open" : "completed",
      ...(!active && { checkOutAt: "2026-11-19T05:00:00Z" }),
    };
    const states = [
      { firstName: "Bilal" },
      [session],
      0,
      null,
      false,
      [],
      0,
      now,
      false,
      "",
      "",
      false,
    ];
    let index = 0;
    const hooks = {
      ...React,
      useEffect() {},
      useRef: (current) => ({ current }),
      useState(initial) {
        return [
          index < states.length ? states[index++] : (index++, initial),
          () => {},
        ];
      },
    };
    const Quote = load("components/DashboardQuote.tsx", {
      react: hooks,
    }).default;
    const Page = load("components/EmployeeDashboard.tsx", {
      react: hooks,
      "next/link": {
        __esModule: true,
        default: ({ children, ...props }) =>
          React.createElement("a", props, children),
      },
      "@/components/AppShell": {
        __esModule: true,
        default: ({ children }) => React.createElement("main", {}, children),
      },
      "@/components/CheckoutConfirmation": {
        __esModule: true,
        default: () => null,
      },
      "@/components/StandupForm": {
        __esModule: true,
        default: () => null,
      },
      "@/components/AnnouncementsPanel": {
        __esModule: true,
        default: () => null,
      },
      "@/components/AttendanceLocationReview": {
        __esModule: true,
        default: () => null,
      },
      "@/components/DailyWorkspace": {
        __esModule: true,
        default: () => React.createElement("section", {}, "Daily work"),
      },
      "@/components/DashboardEngagement": {
        __esModule: true,
        default: ({ compact }) =>
          React.createElement(
            "aside",
            {},
            compact ? "Weather only" : "Duplicate quote",
          ),
      },
      "@/components/DashboardQuote": { __esModule: true, default: Quote },
      "@/components/AttendanceInsights": {
        AttendanceInsights: () => null,
        AttendanceLocation: () => null,
      },
      "@/components/ui": {
        EmptyState: () => null,
        ErrorBanner: () => null,
        StatusPill: () => null,
      },
      "@/lib/attendanceClock": { attendanceClock },
      "@/lib/api": {},
      "@/lib/workspace": {},
      "@/lib/attendanceDevice": {},
    }).default;
    const html = renderToStaticMarkup(React.createElement(Page));
    const banner = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>"),
    );
    assert.match(banner, /Quranic quote/);
    assert.match(banner, /Qur’an/);
    assert.match(banner, new RegExp(active ? "02:02:03" : "00:00:00"));
    assert.match(banner, /role="timer" aria-live="off"/);
    assert.doesNotMatch(
      banner,
      /Local time|Your tasks, schedule|Your workspace|lucide-clock|lucide-log-/,
    );
    assert.match(banner, /Weather only/);
    assert.match(html, /Weather only/);
    assert.doesNotMatch(html, /Duplicate quote/);
  }
});
