import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "../../types.ts";
import { withLinks } from "../../utils/links.ts";
import { applyMove, applyResize } from "./drag.ts";

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: id, desc: "", duration: 2, manualStart: null, tradeIds: [], dependencyId: null, allowWeekend: false, allowHoliday: false, ...over,
});

test("moving right shifts successors with a manual start, through every kind of link", () => {
  const base = [
    task("a", { manualStart: "2026-06-22" }),
    withLinks(task("b", { manualStart: "2026-06-24" }), [{ taskId: "a", type: "FS", lag: 0 }]),
    withLinks(task("c", { manualStart: "2026-06-30" }), [{ taskId: "b", type: "SS", lag: 1 }, { taskId: "x", type: "FS", lag: 0 }]),
    task("d", { manualStart: "2026-06-25" }),
  ];
  const r = applyMove(base, "a", "2026-06-24", 2);
  assert.equal(r[0].manualStart, "2026-06-24");
  assert.equal(r[1].manualStart, "2026-06-26");
  assert.equal(r[2].manualStart, "2026-07-02");
  assert.equal(r[3].manualStart, "2026-06-25"); // unrelated
  assert.equal(base[1].manualStart, "2026-06-24"); // baseline untouched
});

test("moving left or resizing leaves successors alone", () => {
  const base = [task("a", { manualStart: "2026-06-22" }), withLinks(task("b", { manualStart: "2026-06-24" }), [{ taskId: "a", type: "FS", lag: 0 }])];
  assert.equal(applyMove(base, "a", "2026-06-20", -2)[1].manualStart, "2026-06-24");
  assert.equal(applyResize(base, "a", 0)[0].duration, 1);
});

test("dependency loops do not hang", () => {
  const base = [
    withLinks(task("a", { manualStart: "2026-06-22" }), [{ taskId: "b", type: "FS", lag: 0 }]),
    withLinks(task("b", { manualStart: "2026-06-23" }), [{ taskId: "a", type: "FS", lag: 0 }]),
  ];
  assert.equal(applyMove(base, "a", "2026-06-23", 1)[1].manualStart, "2026-06-24");
});
