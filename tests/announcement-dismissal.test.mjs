import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import ts from "typescript";

const require = createRequire(import.meta.url);
test("read announcements disappear immediately and after reload, with older unread posts backfilled", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const storageKey = "hrm_read_announcements_user-1";
  const item = (id, updatedAt = "2026-11-19") => ({ id, title: `Announcement ${id}`, content: "Company update", updatedAt, createdAt: "2026-11-18", status: "published" });
  dom.window.localStorage.setItem(storageKey, JSON.stringify(["read:2026-11-19"]));
  const calls = [];
  const api = { get: async (path) => {
    calls.push(path);
    const page = Number(new URL(path, "http://localhost").searchParams.get("page"));
    return { announcements: page === 1 ? [item("read")] : [item("older")], page, lastPage: 2, totalCount: 2 };
  } };
  const scope = { exports: {}, localStorage: dom.window.localStorage, window: dom.window, setInterval, clearInterval, require(name) {
    if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (name === "@/lib/api") return { api };
    if (name === "@/lib/workspace") return { errorMessage: String };
    if (name === "@/lib/access") return { portalPrefix: () => "" };
    if (name === "@/lib/auth") return { getSession: () => ({ userId: "user-1" }) };
    return require(name);
  } };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../components/AnnouncementsPanel.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, scope);
  const Panel = scope.exports.default;
  const container = dom.window.document.getElementById("root");
  let root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(Panel, { unreadOnly: true })));
    assert.doesNotMatch(container.textContent, /Announcement read/);
    assert.match(container.textContent, /Announcement older/);
    assert(calls.some((path) => path.includes("page=2")));
    await act(async () => container.querySelector(".announcement-read-button").click());
    assert.equal(container.textContent, "", "the entire dashboard panel disappears when all posts are read");
    assert(JSON.parse(dom.window.localStorage.getItem(storageKey)).includes("older:2026-11-19"));
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(React.createElement(Panel, { unreadOnly: true })));
    assert.equal(container.textContent, "", "read posts do not return on remount or polling");
    // The full announcement page remains an archive, including read posts.
    await act(async () => root.render(React.createElement(Panel, { compact: false })));
    assert.match(container.textContent, /Announcement read/);
    // An edited post has a new revision and becomes unread again.
    api.get = async () => ({ announcements: [item("read", "2026-11-20")], page: 1, lastPage: 1, totalCount: 1 });
    await act(async () => root.render(React.createElement(Panel, { unreadOnly: true })));
    assert.match(container.textContent, /Announcement read/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
