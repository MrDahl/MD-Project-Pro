import { test } from "node:test";
import assert from "node:assert/strict";
import { findWarnings } from "./warnings.ts";
import type { Stage, Task, Trade } from "../types.ts";

const trade = (id: string): Trade => ({ id, name: id.toUpperCase(), rate: 1, isFixedPrice: false, weekendSupplement: 0, holidaySupplement: 0, color: "#000" });
const stage = (id: string, startDate: string, endDate: string): Stage => ({ id, name: `Etape ${id}`, color: "#000", startDate, endDate });
const task = (id: string, calcStart: string | null, calcEnd: string | null, extra: Partial<Task> = {}): Task => ({
  id, title: id, desc: "", duration: 1, manualStart: null, tradeIds: ["m"], dependencyId: null, allowWeekend: false, allowHoliday: false, calcStart, calcEnd, ...extra,
});

test("no warnings for a clean plan", () => {
  const ts = [task("a", "2026-06-22", "2026-06-24", { stageId: "s" }), task("b", "2026-06-25", "2026-06-26", { stageId: "s" })];
  assert.deepEqual(findWarnings(ts, [trade("m")], [stage("s", "2026-06-22", "2026-06-30")]), []);
});

test("task ending after / starting before its stage", () => {
  const ts = [task("a", "2026-06-22", "2026-07-03", { stageId: "s" }), task("b", "2026-06-10", "2026-06-12", { stageId: "s" })];
  const w = findWarnings(ts, [trade("m")], [stage("s", "2026-06-22", "2026-06-30")]);
  assert.deepEqual(w.map((x) => x.kind).sort(), ["after-stage-end", "before-stage-start"]);
});

test("task without trade (milestones and recurring exempt)", () => {
  const ts = [
    task("a", "2026-06-22", "2026-06-23", { tradeIds: [] }),
    task("ms", "2026-06-24", "2026-06-24", { tradeIds: [], isMilestone: true }),
    task("rec", null, null, { tradeIds: [], isRecurring: true }),
  ];
  const w = findWarnings(ts, [], []);
  assert.equal(w.length, 1);
  assert.equal(w[0].kind, "no-trade");
  assert.deepEqual(w[0].taskIds, ["a"]);
});

test("double booking: overlapping tasks with the same trade", () => {
  const ts = [task("a", "2026-06-22", "2026-06-26"), task("b", "2026-06-24", "2026-06-25"), task("c", "2026-06-29", "2026-06-30")];
  const w = findWarnings(ts, [trade("m")], []);
  assert.equal(w.length, 1);
  assert.equal(w[0].kind, "double-booking");
  assert.deepEqual([...w[0].taskIds].sort(), ["a", "b"]);
});

test("different trades or back-to-back tasks are not double booked", () => {
  const ts = [task("a", "2026-06-22", "2026-06-23", { tradeIds: ["m"] }), task("b", "2026-06-22", "2026-06-23", { tradeIds: ["t"] }), task("c", "2026-06-24", "2026-06-25", { tradeIds: ["m"] })];
  assert.deepEqual(findWarnings(ts, [trade("m"), trade("t")], []), []);
});

test("long task overlapping two later ones is reported for both", () => {
  const ts = [task("a", "2026-06-22", "2026-07-10"), task("b", "2026-06-23", "2026-06-24"), task("c", "2026-06-30", "2026-07-01")];
  const w = findWarnings(ts, [trade("m")], []);
  assert.equal(w.length, 2);
});

test("unscheduled tasks are reported", () => {
  const w = findWarnings([task("a", null, null)], [trade("m")], []);
  assert.deepEqual(w.map((x) => x.kind), ["unscheduled"]);
});
