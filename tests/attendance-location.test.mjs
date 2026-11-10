import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/attendanceGeolocation.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture({ secure = true, supported = true, watch = true } = {}) {
  const timers = new Map(), options = [], cleared = [];
  let counter = 0, high, standard;
  const geo = {
    watchPosition(success, failure, settings) { high = { success, failure }; options.push(settings); return 42; },
    clearWatch(id) { cleared.push(id); },
    getCurrentPosition(success, failure, settings) { standard = { success, failure }; options.push(settings); },
  };
  if (!watch) delete geo.watchPosition;
  const scope = { exports: {}, URL, Date, window: { isSecureContext: secure }, navigator: { geolocation: supported ? geo : undefined }, setTimeout(fn) { timers.set(++counter, fn); return counter; }, clearTimeout(id) { timers.delete(id); } };
  runInNewContext(source, scope);
  return { ...scope.exports, options, cleared, timers, high: () => high, standard: () => standard, tick() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); } };
}
const position = (accuracy = 25, timestamp = Date.now(), latitude = 33.7) => ({ coords: { latitude, longitude: 73, accuracy }, timestamp });

test("waits through an unavailable reading and accepts a later fresh position", async () => {
  const client = fixture(), result = client.captureAttendanceLocation();
  client.high().failure({ code: 2 }); assert.equal(client.cleared.length, 0);
  client.high().success(position()); const point = await result;
  assert.equal(point.latitude, 33.7); assert.equal(point.accuracyMeters, 25);
  assert.ok(point.locationCapturedAt); assert.equal(point.locationUnavailable, undefined);
  assert.deepEqual(client.cleared, [42]); assert.equal(client.timers.size, 0);
});

test("keeps the most accurate fresh watch reading before the time limit", async () => {
  const client = fixture(), result = client.captureAttendanceLocation();
  client.high().success(position(900)); client.high().success(position(300)); client.high().success(position(1500)); client.tick();
  assert.equal((await result).accuracyMeters, 300); assert.equal(client.options.length, 1);
});

test("uses a standard accuracy retry and ignores old queued watch events", async () => {
  const client = fixture(), result = client.captureAttendanceLocation();
  client.high().failure({ code: 2 }); client.tick(); client.high().success(position()); client.standard().success(position(200));
  assert.equal((await result).accuracyMeters, 200);
  assert.deepEqual(client.options.map((option) => option.enableHighAccuracy), [true, false]);
  assert.ok(client.options.every((option) => option.maximumAge === 0)); assert.deepEqual(client.cleared, [42]);
});

test("unavailable and timed-out devices reject attendance instead of returning location-free submissions", async () => {
  for (const code of [2, 3]) {
    const client = fixture(), result = client.captureAttendanceLocation();
    const rejected = assert.rejects(result, (error) => error.code === code);
    client.high().failure({ code }); client.tick(); client.standard().failure({ code }); await rejected;
    assert.equal(client.timers.size, 0);
  }
  const silent = fixture(), pending = silent.captureAttendanceLocation();
  const rejected = assert.rejects(pending, (error) => error.code === 3);
  silent.tick(); silent.tick(); await rejected;
});

test("stale, out-of-range and malformed browser readings cannot become attendance coordinates", async () => {
  for (const value of [position(10, Date.now() - 60000), position(10, Date.now() + 60000), position(-1), position(20, Date.now(), 100), position(NaN)]) {
    const client = fixture(), result = client.captureAttendanceLocation();
    const rejected = assert.rejects(result, /could not locate/);
    client.high().success(value); client.tick(); client.standard().success(value); await rejected;
  }
});

test("permission denial, unsupported browser and insecure page fail without bypassing location", async () => {
  const denied = fixture(), result = denied.captureAttendanceLocation();
  const rejected = assert.rejects(result, /Location access is blocked/); denied.high().failure({ code: 1 }); await rejected;
  assert.deepEqual(denied.cleared, [42]); assert.equal(denied.timers.size, 0);
  for (const settings of [{ secure: false }, { supported: false }]) {
    const client = fixture(settings); await assert.rejects(client.captureAttendanceLocation()); assert.equal(client.options.length, 0);
  }
});

test("browsers without watchPosition retain a strict two-attempt fallback", async () => {
  const client = fixture({ watch: false }), result = client.captureAttendanceLocation();
  client.standard().failure({ code: 2 }); client.standard().success(position());
  assert.equal((await result).latitude, 33.7); assert.equal(client.options.length, 2);
});

test("manual pin parser accepts coordinates and full Maps links without resolving short links", () => {
  const { parseLocationPin } = fixture();
  for (const input of ["33.7, 73", "https://www.google.com/maps?q=33.7,73", "https://maps.google.com/?query=33.7%2C73", "https://www.openstreetmap.org/?mlat=33.7&mlon=73", "https://www.google.com/maps/place/Test/@30,70,10z/data=!3d33.7!4d73"]) {
    const point = parseLocationPin(input); assert.equal(point.latitude, 33.7); assert.equal(point.longitude, 73);
  }
  for (const input of ["", "91,73", "33,181", "https://maps.app.goo.gl/abc", "https://example.com/?q=33.7,73", "https://openstreetmap.org/?mlat=&mlon=73", "NaN,73", "http://google.com/?q=33.7,73"]) assert.equal(parseLocationPin(input), null, input);
});
