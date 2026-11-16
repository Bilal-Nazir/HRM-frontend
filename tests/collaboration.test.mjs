import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const requestId = "6ae98f07779ddf809548edab";
const link = { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
function load(file, mocks = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const scope = { exports: {}, Date, Intl, require: (name) => name in mocks ? mocks[name] : require(name) };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, scope);
  return scope.exports;
}
function hooks(states = []) {
  let index = 0;
  return { ...React, useState: (initial) => [index < states.length ? states[index++] : (index++, initial), () => {}], useEffect: () => {}, useRef: (current) => ({ current }) };
}
function renderRequest({ canReview = false, canComment = true, canCancel = false, tab = "all", error = "", adminPortal = false } = {}) {
  const details = {
    request: { id: requestId, leaveTypeName: "Casual", status: "pending", startDate: "2026-12-18", endDate: "2026-12-21", totalDays: 4, reason: "Family event <script>alert(1)</script>", createdAt: "2026-11-16T07:00:00Z", employee: { name: "Sam Example", employeeCode: "E-1", jobTitle: "Engineer" } },
    comments: [{ id: "comment-1", body: "Please confirm cover arrangements.", authorName: "Alex Example", authorRole: "manager", createdAt: "2026-11-16T08:00:00Z" }],
    history: [{ id: "created", action: "submitted", authorName: "Sam Example", createdAt: "2026-11-16T07:00:00Z" }],
    reviewers: [{ id: "manager-1", name: "Alex Example", jobTitle: "Team lead" }],
    permissions: { canReview, canComment, canCancel, role: canReview ? "admin" : "manager" },
  };
  const Page = load("components/RequestDetailsPage.tsx", {
    react: hooks([tab]), "next/link": link,
    "next/navigation": { useParams: () => ({ requestId }), usePathname: () => `${adminPortal ? "/admin" : ""}/leave/${requestId}` },
    "@/components/AppShell": { __esModule: true, default: ({ children }) => React.createElement("main", {}, children) },
    "@/components/ui": { ErrorBanner: ({ message }) => React.createElement("div", { role: "alert" }, message), StatusPill: ({ value }) => React.createElement("span", {}, value) },
    "@/lib/api": {}, "@/lib/useLiveData": { useLiveData: () => ({ data: details, error, refresh: () => {} }) },
    "@/lib/workspace": {},
  }).default;
  return renderToStaticMarkup(React.createElement(Page));
}

test("manager request screen shows details, discussion and history without admin decision controls", () => {
  const html = renderRequest();
  for (const text of ["Casual request", "December 18, 2026", "December 21, 2026", "4 days", "Team lead", "Add a comment", "submitted this request", "Please confirm cover arrangements."]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, />Approve<|>Reject<|Admin decision|Cancel my request/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
test("company admins see decisions on the user portal too; comments and history tabs are separate", () => {
  const admin = renderRequest({ canReview: true });
  assert.match(admin, /Admin decision/);
  assert.match(admin, />Approve</);
  assert.match(admin, />Reject</);
  assert.match(admin, /href="\/leave"/);
  const comments = renderRequest({ tab: "comments" });
  assert.match(comments, /Please confirm cover arrangements/);
  assert.doesNotMatch(comments, /submitted this request/);
  const history = renderRequest({ tab: "history", adminPortal: true });
  assert.doesNotMatch(history, /Please confirm cover arrangements/);
  assert.match(history, /submitted this request/);
  assert.match(history, /href="\/admin\/leave"/);
});
test("revoked request access hides previously loaded private data and all actions", () => {
  const html = renderRequest({ canReview: true, error: "Request not found" });
  assert.match(html, /Request not found/);
  assert.doesNotMatch(html, /Family event|Sam Example|Add a comment|Admin decision/);
});
test("chat header counts unread conversations and group mentions and links to the selected portal", () => {
  const chat = load("lib/chat.ts");
  const Launcher = load("components/ChatLauncher.tsx", {
    react: hooks([true, true]), "next/link": link, "@/lib/chat": chat,
    "@/components/Avatar": { __esModule: true, default: ({ name }) => React.createElement("span", {}, name) },
    "@/components/ChatProvider": { useChatInbox: () => ({ error: "", inbox: { unreadConversations: 2, unreadCount: 8, mentionCount: 3, conversations: [{ id: requestId, title: "Project example", kind: "project", unreadCount: 8, mentionCount: 3, lastMessage: "@Alex please review" }] } }) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Launcher, { isAdmin: true }));
  assert.match(html, /Chat: 2 unread conversations, 3 unread group mentions/);
  assert.match(html, /@3/);
  assert.match(html, new RegExp(`href="/admin/chat\\?conversation=${requestId}&amp;mentions=1"`));
  assert.match(html, /href="\/admin\/chat\?new=1"/);
});

test("profile settings let every account upload a picture while employment names remain company managed", () => {
  function render(employee, pending = null) {
    const profile = { user: { userId: requestId, loginId: "alex", name: "Alex Example", photoVersion: "v1" }, employee };
    const Page = load("components/ProfileSettings.tsx", {
      react: hooks([profile, "Alex Example", false, "", "", pending]),
      "@/components/AppShell": { __esModule: true, default: ({ children }) => React.createElement("main", {}, children) },
      "@/components/Avatar": { __esModule: true, default: ({ name }) => React.createElement("span", {}, name) },
      "@/components/ui": { PageHeader: ({ title }) => React.createElement("h1", {}, title), ErrorBanner: () => null },
      "@/lib/api": {}, "@/lib/auth": {}, "@/lib/workspace": {},
    }).default;
    return renderToStaticMarkup(React.createElement(Page));
  }
  const employee = render({ name: "Alex Example", jobTitle: "Engineer" });
  assert.match(employee, /Choose profile photo/);
  assert.match(employee, /image\/jpeg,image\/png,image\/webp/);
  assert.match(employee, /Change photo/);
  assert.match(employee, /Remove/);
  assert.match(employee, /employment name is managed by your company admin/);
  assert.doesNotMatch(employee, /Save name/);
  assert.match(render(null), /Save name/);
  const preview = render(null, { data: "data:image/png;base64,dGVzdA==", filename: "photo.png" });
  assert.match(preview, /Selected profile photo preview/);
  assert.match(preview, /Save photo/);
  assert.doesNotMatch(preview, /Trash2/);
});

test("Super Admin inbox requires an explicit company before showing conversations", () => {
  const user = { userId: requestId, accountType: "admin", isPlatformAdmin: true };
  function render(scoped) {
    const Gate = load("components/ChatCompanyGate.tsx", {
      react: hooks([{ ...user, ...(scoped ? { organizationId: requestId } : {}) }, [{ id: requestId, name: "Example Company", canEnter: true }], "", false]),
      "@/lib/api": {}, "@/lib/auth": {}, "@/lib/workspace": {},
      "@/components/ui": { ErrorBanner: () => null },
    }).default;
    return renderToStaticMarkup(React.createElement(Gate, {}, "Conversation contents"));
  }
  assert.match(render(false), /Choose a company/);
  assert.match(render(false), /Example Company/);
  assert.doesNotMatch(render(false), /Conversation contents/);
  assert.match(render(true), /Conversation contents/);
});

test("company employee search matches names, IDs and job titles without adding foreign records", () => {
  const { filterChatPeople } = load("lib/chat.ts");
  const people = [{ userId: "1", name: "Bilal Nazir", employeeCode: "NV-006", jobTitle: "Full Stack Developer" }, { userId: "2", name: "Sam Example", employeeCode: "NV-007", jobTitle: "Designer" }];
  assert.equal(filterChatPeople(people, " bilal developer ")[0].userId, "1");
  assert.equal(filterChatPeople(people, "nv-007")[0].name, "Sam Example");
  assert.equal(filterChatPeople(people, "designer").length, 1);
  assert.equal(filterChatPeople(people, "another company").length, 0);
  assert.equal(filterChatPeople(people, "").length, 2);
});
