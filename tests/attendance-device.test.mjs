import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = (file) => ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
function collect(hints) {
  const scope = { exports: {}, Intl, setTimeout, clearTimeout, navigator: { platform: "MacIntel", language: "en-GB", maxTouchPoints: 0, hardwareConcurrency: 8, userAgentData: hints }, window: { screen: { width: 1440, height: 900 }, innerWidth: 1200, innerHeight: 800, devicePixelRatio: 2 } };
  runInNewContext(compile("lib/attendanceDevice.ts"), scope);
  return scope.exports.captureAttendanceDevice();
}

test("client collection works without Chromium-only hints", async () => {
  const device = await collect();
  assert.equal(device.platform, "MacIntel"); assert.equal(device.screenWidth, 1440); assert.equal(device.logicalProcessors, 8); assert.equal(device.pixelRatio, 2);
  assert.equal(device.macAddress, undefined);
});

test("available hints are captured; permission denial and slow hints do not block check-in", async () => {
  const result = await collect({ platform: "Android", mobile: true, getHighEntropyValues: async () => ({ model: "Pixel 8", architecture: "arm", bitness: "64" }) });
  assert.equal(result.model, "Pixel 8"); assert.equal(result.mobile, true);
  assert.equal((await collect({ getHighEntropyValues: async () => { throw new Error("Denied"); } })).screenWidth, 1440);
  assert.equal((await collect({ getHighEntropyValues: () => new Promise(() => {}) })).screenWidth, 1440);
});

test("admin device viewer presents both snapshots and handles historical records", () => {
  const scope = { exports: {}, require };
  runInNewContext(compile("components/AttendanceDevices.tsx"), scope);
  const Component = scope.exports.default;
  const checkIn = { capturedAt: "2026-11-06T10:00:00Z", deviceType: "desktop", browser: "Chrome", os: "macOS", ipAddress: "8.8.8.8", publicIpAddress: "8.8.8.8", connectionIp: "172.18.0.4" };
  const html = renderToStaticMarkup(React.createElement(Component, { checkIn, checkOut: { ...checkIn, deviceType: "mobile", browser: "Safari", os: "iOS" }, completed: true }));
  for (const value of ["Check-in device", "Check-out device", "Chrome", "Safari", "macOS", "iOS", "Public internet IP", "8.8.8.8", "172.18.0.4", "Unavailable in web browsers"]) assert.ok(html.includes(value), value);
  assert.match(html, /<details/);
  assert.match(renderToStaticMarkup(React.createElement(Component, {})), /Not recorded/);
  assert.match(renderToStaticMarkup(React.createElement(Component, { checkIn })), /Awaiting check-out/);
  const oldSnapshot = renderToStaticMarkup(React.createElement(Component, { checkIn: { ...checkIn, publicIpAddress: undefined, ipAddress: "172.18.0.1" } }));
  assert.match(oldSnapshot, /Not captured for this session/);
});
