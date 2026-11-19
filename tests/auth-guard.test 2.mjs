import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";

const require = createRequire(import.meta.url);
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: "https://hrm.example/login" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "Event", "StorageEvent"]) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require("react-dom/client");
function load(file, mocks = {}, extra = {}) {
  const context = { exports: {}, window, document, localStorage: window.localStorage, Event: window.Event, URL, URLSearchParams, atob, process: { env: { NEXT_PUBLIC_API_URL: "/api" } }, require: (name) => mocks[name] || (name === "@/lib/apiUrl" ? load("lib/apiUrl.ts") : require(name)), ...extra };
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, context);
  return context.exports;
}
const auth = load("lib/auth.ts");
const routes = load("lib/authRoutes.ts", { "@/lib/taskLinks": load("lib/taskLinks.ts") });
const user = { userId: "user-1", employeeId: "employee-1", organizationId: "org-1", loginId: "E-1", permissions: ["employee.read.self"], accountType: "employee" };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const response = (status, data = {}, message = "Invalid session") => new Response(JSON.stringify({ data, message }), { status, headers: { "Content-Type": "application/json" } });
function store(value = user, refresh = "refresh-1") { auth.clearSession(); if (value) auth.saveSession("access-1", refresh, value); }

test("session parsing tolerates corrupt or disabled storage and clears stale portal cookies", () => {
  store(null);
  for (const value of ["{broken", "null", "[]", JSON.stringify({ ...user, permissions: "*" }), JSON.stringify({ ...user, accountType: "superuser" })]) {
    window.localStorage.setItem("hrm_user", value); assert.equal(auth.getSession(), null);
  }
  const blocked = load("lib/auth.ts", {}, { localStorage: { getItem() { throw Error("Blocked"); } } });
  assert.equal(blocked.getSession(), null);
  store(); assert.equal(auth.getSession().userId, user.userId);
  assert.match(document.cookie, /hrm_account_type=employee/);
  auth.clearSession(); assert.equal(document.cookie.includes("hrm_account_type"), false);
});

test("middleware redirects unauthenticated URLs before rendering, and preserves safe return links", () => {
  const { NextRequest } = require("next/server");
  const { middleware } = load("middleware.ts", { "@/lib/authRoutes": routes, "@/lib/taskLinks": load("lib/taskLinks.ts") });
  for (const path of ["/dashboard", "/attendance", "/projects/abc/board?assignee=BN", "/admin/employees", "/admin/projects/abc/board"]) {
    const result = middleware(new NextRequest(`https://hrm.example${path}`));
    const destination = new URL(result.headers.get("location"));
    assert.equal(result.status, 307);
    assert.equal(destination.pathname, path.startsWith("/admin/") ? "/admin/login" : "/login");
    assert.equal(destination.searchParams.get("next"), path);
  }
  for (const login of ["/login", "/admin/login"]) assert.equal(middleware(new NextRequest(`https://hrm.example${login}`)).headers.get("location"), null);
  assert.equal(middleware(new NextRequest("https://hrm.example/", { headers: { cookie: "hrm_account_type=admin" } })).headers.get("location"), "https://hrm.example/admin/dashboard");
  assert.equal(middleware(new NextRequest("https://hrm.example/admin/dashboard", { headers: { cookie: "hrm_account_type=employee" } })).headers.get("location"), "https://hrm.example/dashboard");
  for (const unsafe of ["https://evil.example", "//evil.example", "/\\evil.example", "/login", "/admin/login", "/projects/%2f%2fevil", "/projects\n/abc"]) assert.equal(routes.authReturnPath(unsafe, "employee"), null);
});

async function fixture(t, path = "/projects/abc/board", initial = user) {
  store(initial);
  window.history.replaceState(null, "", path);
  const checks = [], redirects = [];
  let currentPath = window.location.pathname, mounted = 0, renders = 0;
  const router = { replace: (href) => redirects.push(href) };
  const api = { get() { const check = deferred(); checks.push(check); return check.promise; } };
  class ApiError extends Error { constructor(status) { super("Request failed"); this.status = status; } }
  const Guard = load("components/AuthGuard.tsx", { "@/lib/auth": auth, "@/lib/authRoutes": routes, "@/lib/api": { api, ApiError }, "@/lib/verifySession": { verifySession: () => api.get() }, "next/navigation": { usePathname: () => currentPath, useRouter: () => router } }).default;
  function PrivatePage() { renders++; React.useEffect(() => { mounted++; }, []); return React.createElement("h1", null, "Private task content"); }
  const node = document.createElement("div"); document.body.append(node);
  const root = createRoot(node);
  const render = () => root.render(React.createElement(Guard, null, React.createElement(PrivatePage)));
  t.after(async () => { await act(async () => root.unmount()); node.remove(); });
  const server = renderToStaticMarkup(React.createElement(Guard, null, React.createElement(PrivatePage)));
  assert.doesNotMatch(server, /Private task content/); assert.equal(renders, 0);
  await act(async () => render());
  return { node, checks, redirects, ApiError, mounted: () => mounted, renders: () => renders, async navigate(path) { currentPath = path; window.history.replaceState(null, "", path); await act(async () => render()); } };
}

test("protected pages never render or start effects before server validation, including subsequent navigation", async (t) => {
  const f = await fixture(t);
  assert.equal(f.renders(), 0); assert.equal(f.mounted(), 0);
  await act(async () => f.checks[0].resolve({ user }));
  assert.match(f.node.innerHTML, /Private task content/); assert.equal(f.mounted(), 1);
  const previous = f.renders();
  await f.navigate("/attendance");
  assert.equal(f.renders(), previous); assert.doesNotMatch(f.node.innerHTML, /Private task content/);
  await act(async () => f.checks[1].resolve({ user }));
  assert.match(f.node.innerHTML, /Private task content/);
});

test("missing and invalid sessions redirect without mounting protected pages", async (t) => {
  const f = await fixture(t, "/admin/employees", null);
  assert.equal(f.checks.length, 0); assert.equal(f.renders(), 0);
  assert.equal(f.redirects[0], "/admin/login?next=%2Fadmin%2Femployees");
});

test("expired sessions, wrong-portal visits and stale cookie hints do not expose page content", async (t) => {
  const f = await fixture(t, "/admin/dashboard");
  await act(async () => f.checks[0].resolve({ user }));
  assert.equal(f.renders(), 0); assert.equal(f.redirects[0], "/dashboard");
  await f.navigate("/projects/abc/board");
  await act(async () => f.checks[1].reject(new f.ApiError(401)));
  assert.equal(f.renders(), 0); assert.equal(auth.getSession(), null);
  assert.match(f.redirects.at(-1), /^\/login\?next=/);
  assert.doesNotMatch(document.cookie, /hrm_account_type/);
});

test("logged-in users skip login content and return to their dashboard or requested page", async (t) => {
  const f = await fixture(t, "/login?next=%2Fattendance");
  await act(async () => f.checks[0].resolve({ user }));
  assert.equal(f.renders(), 0); assert.equal(f.redirects[0], "/attendance");
});

test("network failures keep guarded content hidden and credentials intact, and support retry", async (t) => {
  const f = await fixture(t);
  await act(async () => f.checks[0].reject(new TypeError("Network offline")));
  assert.equal(f.renders(), 0); assert.match(f.node.innerHTML, /Unable to verify your session/);
  assert.equal(auth.getSession().userId, user.userId); assert.equal(f.redirects.length, 0);
  await act(async () => f.node.querySelector("button").click());
  await act(async () => f.checks[1].resolve({ user }));
  assert.match(f.node.innerHTML, /Private task content/);
});

test("logout and account changes invalidate mounted pages and ignore stale verification responses", async (t) => {
  const f = await fixture(t);
  const nextUser = { ...user, userId: "user-2", loginId: "E-2" };
  await act(async () => auth.saveSession("access-2", "refresh-2", nextUser));
  await act(async () => f.checks[0].resolve({ user }));
  assert.equal(f.renders(), 0); assert.equal(auth.getSession().userId, "user-2");
  await act(async () => f.checks[1].resolve({ user: nextUser }));
  assert.match(f.node.innerHTML, /Private task content/);
  const validations = f.checks.length;
  await act(async () => { window.localStorage.setItem("hrm_token", "refreshed-in-another-tab"); window.dispatchEvent(new window.StorageEvent("storage", { key: "hrm_token", oldValue: "access-2", newValue: "refreshed-in-another-tab" })); });
  assert.equal(f.checks.length, validations); assert.match(f.node.innerHTML, /Private task content/);
  await act(async () => { window.localStorage.clear(); window.dispatchEvent(new window.StorageEvent("storage", { key: null })); });
  assert.doesNotMatch(f.node.innerHTML, /Private task content/); assert.match(f.redirects.at(-1), /^\/login\?next=/);
});

test("parallel expired API calls share one refresh and retry with the refreshed token", async () => {
  store(); let refreshes = 0; const pending = deferred();
  const api = load("lib/api.ts", { "@/lib/auth": auth }, { fetch: async (url, options) => {
    if (url === "/api/auth/refresh") { refreshes++; return pending.promise; }
    return options.headers.Authorization === "Bearer access-2" ? response(200, { ok: true }) : response(401);
  } }).api;
  const first = api.get("/projects"), second = api.get("/notifications");
  await new Promise((resolve) => setTimeout(resolve, 0)); assert.equal(refreshes, 1);
  pending.resolve(response(200, { accessToken: "access-2" }));
  assert.deepEqual(JSON.parse(JSON.stringify(await Promise.all([first, second]))), [{ ok: true }, { ok: true }]);
  assert.equal(auth.readAuthValue("hrm_token"), "access-2");
});

test("terminal 401 responses clear storage and cookies with or without a refresh token", async () => {
  for (const refresh of ["refresh-1", ""]) {
    store(user, refresh);
    const api = load("lib/api.ts", { "@/lib/auth": auth }, { fetch: async () => response(401) }).api;
    await assert.rejects(api.get("/auth/session"), (error) => error.status === 401);
    assert.equal(auth.getSession(), null); assert.equal(auth.readAuthValue("hrm_token"), null);
    assert.doesNotMatch(document.cookie, /hrm_account_type/);
  }
  store(); let refreshes = 0;
  const api = load("lib/api.ts", { "@/lib/auth": auth }, { fetch: async (url) => { if (url === "/api/auth/refresh") { refreshes++; return response(200, { accessToken: "new-but-rejected" }); } return response(401); } }).api;
  await assert.rejects(api.get("/auth/session"), (error) => error.status === 401);
  assert.equal(refreshes, 1); assert.equal(auth.getSession(), null);
});

test("a failed login, temporary refresh failure or stale refresh cannot clear a newer session", async () => {
  store();
  const login = load("lib/api.ts", { "@/lib/auth": auth }, { fetch: async () => response(401) }).api;
  await assert.rejects(login.post("/auth/login", {})); assert.ok(auth.getSession());
  const offline = load("lib/api.ts", { "@/lib/auth": auth }, { fetch: async (url) => { if (url === "/api/auth/refresh") throw new TypeError("Offline"); return response(401); } }).api;
  await assert.rejects(offline.get("/projects")); assert.ok(auth.getSession());
  const pending = deferred();
  const stale = load("lib/api.ts", { "@/lib/auth": auth }, { fetch: async (url) => url === "/api/auth/refresh" ? pending.promise : response(401) }).api;
  const request = stale.get("/projects");
  await new Promise((resolve) => setTimeout(resolve, 0));
  auth.saveSession("access-2", "refresh-2", { ...user, userId: "user-2" });
  pending.resolve(response(401));
  await assert.rejects(request);
  assert.equal(auth.getSession().userId, "user-2"); assert.equal(auth.readAuthValue("hrm_token"), "access-2");
});

test("backend configuration supports independent hosts and normalizes URL prefixes", () => {
  const { resolveApiUrl, productionApiUrl } = load("lib/apiUrl.ts");
  assert.equal(resolveApiUrl(undefined, true), "https://3.126.250.133/api");
  assert.equal(resolveApiUrl(undefined), "https://3.126.250.133/api");
  assert.equal(resolveApiUrl("   ", false), productionApiUrl);
  assert.equal(resolveApiUrl(" https://api.example.com/api/// ", true), "https://api.example.com/api");
  assert.equal(resolveApiUrl("/api/"), "/api");
  assert.equal(productionApiUrl, "https://3.126.250.133/api");
  for (const invalid of ["//evil.example", "javascript:alert(1)", "api.example.com", "https://user:password@api.example.com", "https://api.example.com?token=secret", "https://api.example.com#health"]) assert.throws(() => resolveApiUrl(invalid, true));
});

test("legacy backend authentication requires a fresh server-issued access token", async () => {
  store({ ...user, accountType: "admin", permissions: ["*"] });
  const claims = { userId: user.userId, employeeId: user.employeeId, organizationId: user.organizationId, permissions: user.permissions, accountType: "employee", tokenType: "access", exp: Math.floor(Date.now() / 1000) + 600 };
  const token = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const calls = [];
  const verifier = load("lib/verifySession.ts", { "@/lib/auth": auth, "@/lib/api": { ApiError, api: {
    async get(path) { calls.push(path); throw new ApiError("Not found", 404); },
    async post(path, body) { calls.push(path); assert.equal(body.refreshToken, "refresh-1"); return { accessToken: token }; },
  } } });
  const result = await verifier.verifySession();
  assert.equal(result.user.accountType, "employee");
  assert.deepEqual(JSON.parse(JSON.stringify(result.user.permissions)), user.permissions);
  assert.equal(auth.readAuthValue("hrm_token"), token);
  assert.deepEqual(calls, ["/auth/session", "/auth/refresh"]);
  await verifier.verifySession(); assert.deepEqual(calls, ["/auth/session", "/auth/refresh", "/auth/refresh"]);
});

test("legacy compatibility never bypasses rejected sessions or accepts malformed, expired or mismatched tokens", async () => {
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  store(); let posts = 0;
  const denied = load("lib/verifySession.ts", { "@/lib/auth": auth, "@/lib/api": { ApiError, api: { async get() { throw new ApiError("Unauthorized", 401); }, async post() { posts++; } } } });
  await assert.rejects(denied.verifySession(), (error) => error.status === 401); assert.equal(posts, 0);
  for (const claims of [null, { ...user, tokenType: "access", exp: 1 }, { ...user, userId: "another-user", tokenType: "access", exp: Date.now() }, { ...user, tokenType: "refresh", exp: Date.now() }]) {
    store();
    const verifier = load("lib/verifySession.ts", { "@/lib/auth": auth, "@/lib/api": { ApiError, api: {
      async get() { throw new ApiError("Not found", 404); },
      async post() { return { accessToken: claims ? `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig` : "malformed" }; },
    } } });
    await assert.rejects(verifier.verifySession(), (error) => error.status === 401);
    assert.equal(auth.readAuthValue("hrm_token"), "access-1");
  }
});
