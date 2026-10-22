import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FILTER, duplicateTask, filterTasks, isFilterActive } from "./taskFilter.ts";
import type { Task, Trade } from "../types.ts";

const trades: Trade[] = [{ id: "m", name: "Murer", rate: 1, isFixedPrice: false, weekendSupplement: 0, holidaySupplement: 0, color: "#000" }];
const t = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, desc: "", duration: 1, manualStart: null, tradeIds: [], dependencyId: null, allowWeekend: false, allowHoliday: false, ...extra });
const tasks = [t("Grave ud", { stageId: "s1", tradeIds: ["m"], isCritical: true }), t("Støb fundament", { stageId: "s1", desc: "Beton" }), t("Aflevering")];

test("empty filter returns everything with original numbers", () => {
  const r = filterTasks(tasks, trades, EMPTY_FILTER);
  assert.deepEqual(r.map((x) => x.number), [1, 2, 3]);
  assert.equal(isFilterActive(EMPTY_FILTER), false);
});

test("search matches title, description and trade name, case-insensitive", () => {
  assert.deepEqual(filterTasks(tasks, trades, { ...EMPTY_FILTER, query: "GRAVE" }).map((x) => x.number), [1]);
  assert.deepEqual(filterTasks(tasks, trades, { ...EMPTY_FILTER, query: "beton" }).map((x) => x.number), [2]);
  assert.deepEqual(filterTasks(tasks, trades, { ...EMPTY_FILTER, query: "murer" }).map((x) => x.number), [1]);
});

test("stage, trade and critical filters combine; numbers stay stable", () => {
  assert.deepEqual(filterTasks(tasks, trades, { ...EMPTY_FILTER, stageId: "s1" }).map((x) => x.number), [1, 2]);
  assert.deepEqual(filterTasks(tasks, trades, { ...EMPTY_FILTER, stageId: "none" }).map((x) => x.number), [3]);
  assert.deepEqual(filterTasks(tasks, trades, { ...EMPTY_FILTER, tradeId: "m", criticalOnly: true }).map((x) => x.number), [1]);
  assert.deepEqual(filterTasks(tasks, trades, { ...EMPTY_FILTER, stageId: "s1", criticalOnly: true, query: "støb" }), []);
});

test("duplicate gives a clean copy", () => {
  const src = t("a", { calcStart: "2026-01-01", calcEnd: "2026-01-02", calcCost: 5, isCritical: true, progress: 60, tradeIds: ["m"] });
  const c = duplicateTask(src, "new");
  assert.equal(c.id, "new");
  assert.equal(c.title, "a (kopi)");
  assert.equal(c.progress, 0);
  assert.equal("calcStart" in c, false);
  assert.equal("isCritical" in c, false);
  assert.notEqual(c.tradeIds, src.tradeIds);
  assert.deepEqual(c.tradeIds, ["m"]);
});
