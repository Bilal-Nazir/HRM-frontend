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
function load(file, mocks = {}) {
  const scope = { exports: {}, URL, require: (name) => mocks[name] || require(name) };
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, scope);
  return scope.exports;
}
const config = load("lib/descriptionEditor.ts");
const Content = load("components/RichTextContent.tsx").default;
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
for (const name of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "DOMParser"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: typeof dom.window[name] === "function" && ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(name) ? dom.window[name].bind(dom.window) : dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no layout engine; ProseMirror still measures the cursor on focus.
dom.window.Range.prototype.getClientRects = () => [];
dom.window.Range.prototype.getBoundingClientRect = () => new dom.window.DOMRect();
const { Editor } = require("@tiptap/core");

test("description formatting survives save and reopen, with legacy lines kept readable", () => {
  const editor = new Editor({ extensions: config.descriptionExtensions(), content: "First line\nSecond line\n\n## Requirements\n\n- **Important** step\n- *Another* step\n\n1. First\n2. Second\n\n[Reference](https://example.com)\n\n~~Old requirement~~", contentType: "markdown" });
  const saved = editor.getMarkdown();
  editor.destroy();
  const reopened = new Editor({ extensions: config.descriptionExtensions(), content: saved, contentType: "markdown" });
  const html = renderToStaticMarkup(React.createElement(Content, { value: reopened.getMarkdown() }));
  assert.match(html, /First line(?:\s|<br\/>)+Second line/);
  for (const pattern of [/<h2>Requirements<\/h2>/, /<ul>/, /<ol>/, /<strong>Important<\/strong>/, /<em>Another<\/em>/, /<del>Old requirement<\/del>/, /href="https:\/\/example.com"/]) assert.match(html, pattern);
  reopened.destroy();
});

test("formatted descriptions escape HTML and reject executable links and embedded images", () => {
  const html = renderToStaticMarkup(React.createElement(Content, { value: '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[Unsafe](javascript:alert%281%29)\n\n![tracking](https://example.com/pixel)\n\n[Safe](https://example.com)' }));
  assert.doesNotMatch(html, /<script|<img|href="javascript:|onerror="/);
  assert.match(html, /href="https:\/\/example.com"/);
  for (const link of ["javascript:alert(1)", "data:text/html,test", "vbscript:foo", "https://exa\nmple.com", ""]) assert.equal(config.descriptionLink(link), null);
  assert.equal(config.descriptionLink("example.com/docs"), "https://example.com/docs");
  assert.equal(config.descriptionLink("mailto:team@example.com"), "mailto:team@example.com");
});

test("editor toolbar formats text without submitting its parent form and retains the cursor", async () => {
  const tiptap = require("@tiptap/react");
  const { createRoot } = require("react-dom/client");
  let editor, saved = "", submissions = 0;
  const Component = load("components/RichTextEditor.tsx", {
    "@/lib/descriptionEditor": config,
    "@tiptap/react": { ...tiptap, useEditor(options) { editor = tiptap.useEditor(options); return editor; } },
  }).default;
  function Form() {
    const [value, setValue] = React.useState("Write the plan");
    return React.createElement("form", { onSubmit(event) { event.preventDefault(); submissions++; } }, React.createElement(Component, { value, onChange(next) { saved = next; setValue(next); } }));
  }
  const root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(Form)));
  assert.ok(editor);
  assert.equal(document.querySelector('[role="textbox"]').getAttribute("aria-multiline"), "true");
  for (const button of document.querySelectorAll("button")) assert.equal(button.type, "button");
  await act(async () => editor.commands.setTextSelection({ from: 1, to: 6 }));
  await act(async () => document.querySelector('[aria-label="Bold"]').click());
  assert.match(saved, /\*\*Write\*\*/);
  assert.equal(document.querySelector('[aria-label="Bold"]').getAttribute("aria-pressed"), "true");
  assert.equal(editor.state.selection.from, 1);
  assert.equal(editor.state.selection.to, 6);
  await act(async () => document.querySelector('[aria-label="Bullet list"]').click());
  assert.match(saved, /^- \*\*Write\*\*/);
  await act(async () => document.querySelector('[aria-label="Undo"]').click());
  assert.doesNotMatch(saved, /^- /);
  await act(async () => document.querySelector('[aria-label="Redo"]').click());
  assert.match(saved, /^- /);
  await act(async () => document.querySelector('[aria-label="Add or edit link"]').click());
  assert.equal(document.activeElement.getAttribute("placeholder"), "https://example.com");
  const input = document.activeElement;
  // Use the native setter so React sees the same input event as the browser.
  const setInput = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  await act(async () => { setInput.call(input, "https://example.com/brief"); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
  await act(async () => [...document.querySelectorAll("button")].find((button) => button.textContent === "Apply").click());
  assert.match(saved, /https:\/\/example.com\/brief/);
  assert.equal(document.querySelector('.rich-text-link'), null);
  assert.equal(submissions, 0);
  await act(async () => root.unmount());
});
