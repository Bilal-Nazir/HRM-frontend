import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks = {}, extra = {}) {
  const scope = {
    exports: {},
    URL,
    URLSearchParams,
    process: { env: { NEXT_PUBLIC_API_URL: "https://backend.example/api" } },
    require: (name) => (name in mocks ? mocks[name] : require(name)),
    ...extra,
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
const page = {
  publicId: "a".repeat(36),
  title: "Frontend Engineer",
  companyName: "Example Company",
  description: "Role details",
  introduction: "Join our team",
  status: "published",
  workMode: "Remote",
  employmentType: "Full-time",
  location: "Islamabad",
  accentColor: "#155eef",
  questions: [{ id: "q1", label: "Notice period?", required: true }],
};

test("candidate API uses remote backend without employee credentials and reports submission errors", async () => {
  const calls = [];
  const apiUrl = load("lib/apiUrl.ts");
  const { careersRequest } = load(
    "lib/hiring.ts",
    { "@/lib/apiUrl": apiUrl },
    {
      fetch: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({ data: { received: true } }), {
          status: 200,
        });
      },
    },
  );
  await careersRequest(page.publicId);
  await careersRequest(page.publicId, { name: "Sam" });
  assert.equal(
    calls[0].url,
    `https://backend.example/api/careers/${page.publicId}`,
  );
  assert.equal(
    calls[1].url,
    `https://backend.example/api/careers/${page.publicId}/applications`,
  );
  for (const { options } of calls) {
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers?.Authorization, undefined);
  }
  const failing = load(
    "lib/hiring.ts",
    { "@/lib/apiUrl": apiUrl },
    {
      fetch: async () =>
        new Response(JSON.stringify({ message: "Applications closed" }), {
          status: 404,
        }),
    },
  );
  await assert.rejects(
    failing.careersRequest(page.publicId),
    /Applications closed/,
  );
});

test("CV picker rejects oversized and unsupported uploads before reading the file", async () => {
  const { readCv } = load("lib/hiring.ts", {
    "@/lib/apiUrl": load("lib/apiUrl.ts"),
  });
  for (const file of [
    { name: "cv.pdf", size: 6 * 1024 * 1024 },
    { name: "cv.exe", size: 100 },
    { name: "cv.docx", size: 0 },
  ])
    await assert.rejects(readCv(file), /PDF, DOC or DOCX/);
});

function publicScreen(status = "published", received = false) {
  let index = 0;
  const states = [{ ...page, status }, false, "", "", false, received, ""];
  const Page = load("components/CareersPage.tsx", {
    react: {
      ...React,
      useState: (initial) => [
        index < states.length ? states[index++] : initial,
        () => {},
      ],
      useEffect: () => {},
    },
    "next/navigation": { useParams: () => ({ publicId: page.publicId }) },
    "@/components/HiringPagePreview": {
      __esModule: true,
      default: ({ page }) => React.createElement("h1", {}, page.title),
    },
    "@/lib/hiring": {},
  }).default;
  return renderToStaticMarkup(React.createElement(Page));
}
test("public candidate page provides questions, CV upload and consent; closed and received states remove the form", () => {
  const open = publicScreen();
  for (const text of [
    "Frontend Engineer",
    "No account needed",
    "Notice period?",
    "Submit application",
    "PDF, DOC or DOCX",
    'name="consent"',
  ])
    assert.ok(open.includes(text), text);
  assert.match(open, /type="file"[^>]*required/);
  assert.doesNotMatch(open, /Sign in|Employee ID/);
  assert.match(publicScreen("closed"), /Applications closed/);
  assert.doesNotMatch(publicScreen("closed"), /<form/);
  assert.match(publicScreen("published", true), /Application received/);
  assert.doesNotMatch(publicScreen("published", true), /<form/);
});

test("public careers pages bypass login while hiring management remains guarded and deep links survive login", () => {
  const links = load("lib/taskLinks.ts"),
    routes = load("lib/authRoutes.ts", { "@/lib/taskLinks": links });
  assert.equal(routes.protectedPortal(`/careers/${page.publicId}`), null);
  assert.equal(routes.protectedPortal("/settings/hiring"), "employee");
  assert.equal(routes.protectedPortal("/admin/settings/hiring"), "admin");
  assert.equal(
    routes.authReturnPath(
      "/settings/hiring?page=page-1&application=app-1",
      "admin",
    ),
    "/admin/settings/hiring?page=page-1&application=app-1",
  );
});
