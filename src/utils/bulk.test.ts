import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBulk, deleteMany } from "./bulk.ts";
import { taskLinks } from "./links.ts";
import type { Task } from "../types.ts";

const mk = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: id, desc: "", duration: 3, manualStart: null, tradeIds: ["a"], dependencyId: null, allowWeekend: false, allowHoliday: false, ...over,
});

test("applyBulk changes stage, trades and duration only for selected tasks", () => {
  const tasks = [mk("1"), mk("2", { isMilestone: true, duration: 0 }), mk("3")];
  const sel = new Set(["1", "2"]);
  const r = applyBulk(tasks, sel, { stageId: "s", addTradeId: "b", durationDelta: 2 });
  assert.equal(r[0].stageId, "s");
  assert.deepEqual(r[0].tradeIds, ["a", "b"]);
  assert.equal(r[0].duration, 5);
  assert.equal(r[1].duration, 0, "milestones keep 0 days");
  assert.equal(r[2], tasks[2], "unselected tasks are untouched (same object)");
  assert.deepEqual(applyBulk(tasks, sel, { setTradeId: "z" })[0].tradeIds, ["z"]);
  assert.deepEqual(applyBulk(tasks, sel, { removeTradeId: "a" })[0].tradeIds, []);
  assert.equal(applyBulk(tasks, sel, { duration: 0 })[0].duration, 1);
  assert.equal(applyBulk(tasks, sel, { stageId: null })[0].stageId, null);
});

test("deleteMany removes tasks and unlinks dependants", () => {
  const tasks = [mk("1"), mk("2", { dependencyId: "1", dependencies: [{ taskId: "1", type: "FS", lag: 0 }] }), mk("3", { dependencyId: "2", dependencies: [{ taskId: "2", type: "FS", lag: 0 }] })];
  const r = deleteMany(tasks, new Set(["1", "2"]));
  assert.equal(r.length, 1);
  assert.equal(taskLinks(r[0]).length, 0);
});
