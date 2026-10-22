import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "../types.ts";
import { baselineById, daysBetween, endDeviationDays, makeBaseline, normalizeBaseline } from "./baseline.ts";
import { buildCostCurve, costItemsFromBaseline, costItemsFromTasks, sampleIndices } from "./curve.ts";

const t = (id: string, calcStart: string | null, calcEnd: string | null, calcCost = 0): Task => ({
  id, title: id, desc: "", duration: 1, manualStart: null, tradeIds: [], dependencyId: null, allowWeekend: false, allowHoliday: false, calcStart, calcEnd, calcCost,
});

test("makeBaseline keeps only scheduled tasks and reads back by id", () => {
  const b = makeBaseline([t("a", "2026-06-22", "2026-06-24", 300), t("b", null, null)], "2026-06-24", 300, new Date("2026-06-01T10:00:00Z"));
  assert.equal(b.tasks.length, 1);
  assert.equal(b.savedAt, "2026-06-01T10:00:00.000Z");
  assert.equal(baselineById(b).get("a")?.cost, 300);
  assert.equal(baselineById(null).size, 0);
});

test("deviation in calendar days", () => {
  const base = { id: "a", start: "2026-06-22", end: "2026-06-24", cost: 0 };
  assert.equal(endDeviationDays({ calcEnd: "2026-06-29" }, base), 5);
  assert.equal(endDeviationDays({ calcEnd: "2026-06-23" }, base), -1);
  assert.equal(endDeviationDays({ calcEnd: "2026-06-24" }, undefined), null);
  assert.equal(daysBetween("2026-06-24", "2026-06-22"), -2);
  assert.equal(daysBetween(null, "2026-06-22"), null);
});

test("normalizeBaseline repairs or rejects", () => {
  assert.equal(normalizeBaseline(null), null);
  assert.equal(normalizeBaseline({ tasks: "x" }), null);
  const b = normalizeBaseline({ savedAt: 5, endDate: "nope", totalCost: "12", tasks: [{ id: "a", start: "2026-06-22", end: "2026-06-23", cost: "7" }, { id: "b", start: "bad", end: "2026-06-23" }, 3] })!;
  assert.equal(b.tasks.length, 1);
  assert.equal(b.tasks[0].cost, 7);
  assert.equal(b.endDate, null);
  assert.equal(b.totalCost, 12);
});

test("cost curve accumulates and ends at the total", () => {
  const items = costItemsFromTasks([t("a", "2026-06-22", "2026-06-23", 200), t("b", "2026-06-23", "2026-06-25", 300), t("free", "2026-06-22", "2026-06-22", 0)]);
  assert.equal(items.length, 2);
  const c = buildCostCurve(items);
  assert.equal(c.values.length, 4);
  assert.ok(Math.abs(c.values[0] - 100) < 1e-9); // 22nd: half of a
  assert.ok(Math.abs(c.values[1] - 300) < 1e-9); // 23rd: rest of a + 1/3 of b
  assert.ok(Math.abs(c.values[3] - 500) < 1e-9);
  for (let i = 1; i < c.values.length; i++) assert.ok(c.values[i] >= c.values[i - 1]);
});

test("cost curve over a shared range includes earlier cost", () => {
  const a = costItemsFromBaseline({ savedAt: "", endDate: null, totalCost: 0, tasks: [{ id: "a", start: "2026-06-22", end: "2026-06-23", cost: 100 }] });
  const day = a[0].start;
  const c = buildCostCurve(a, day - 3, day + 5);
  assert.equal(c.values.length, 9);
  assert.equal(c.values[0], 0);
  assert.ok(Math.abs(c.values[8] - 100) < 1e-9);
  const late = buildCostCurve(a, day + 1, day + 3); // range starts after the first day
  assert.ok(Math.abs(late.values[0] - 100) < 1e-9);
  assert.deepEqual(buildCostCurve([]).values, []);
});

test("sampleIndices keeps first and last", () => {
  assert.deepEqual(sampleIndices(3, 10), [0, 1, 2]);
  const s = sampleIndices(1000, 50);
  assert.equal(s.length, 50);
  assert.equal(s[0], 0);
  assert.equal(s[49], 999);
});
