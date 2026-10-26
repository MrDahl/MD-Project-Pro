import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd, buildQuickTask } from "./quickAdd.ts";
import type { Stage, Task, Trade } from "../types.ts";

test("parses days, weeks and hours", () => {
  assert.deepEqual(parseQuickAdd("Maling 5 dage").days, 5);
  assert.equal(parseQuickAdd("Maling 5 dage").title, "Maling");
  assert.equal(parseQuickAdd("Gulv 2 uger").days, 10);
  assert.equal(parseQuickAdd("Gulv 3d").days, 3);
  assert.equal(parseQuickAdd("Rillefræsning 4 timer").hours, 4);
  assert.equal(parseQuickAdd("Oprydning 1,5 t").hours, 1.5);
  assert.equal(parseQuickAdd("Kun titel").days, undefined);
  assert.equal(parseQuickAdd("Kun titel").title, "Kun titel");
});

test("parses trade, stage, predecessor and milestone", () => {
  const p = parseQuickAdd("Maling af stue 5 dage @Maler #Indvendigt efter Gipsplader");
  assert.equal(p.title, "Maling af stue");
  assert.equal(p.days, 5);
  assert.deepEqual(p.tradeNames, ["Maler"]);
  assert.equal(p.stageName, "Indvendigt");
  assert.equal(p.afterTitle, "Gipsplader");
  const m = parseQuickAdd("Aflevering milepæl");
  assert.equal(m.milestone, true);
  assert.equal(m.title, "Aflevering");
  assert.deepEqual(parseQuickAdd("Montage @Elektriker (svend) @Tømrer").tradeNames, ["Elektriker (svend)", "Tømrer"]);
});

const trades = [{ id: "t1", name: "Maler" }, { id: "t2", name: "Elektriker (svend)" }] as Trade[];
const stages = [{ id: "s1", name: "Indvendigt" }] as Stage[];
const tasks = [{ id: "a", title: "Gipsplader" }] as Task[];

test("builds a task and links names", () => {
  const r = buildQuickTask("Maling 5 dage @mal #indv efter gips", { trades, stages, tasks, hoursPerDay: 7.4, newId: "x" });
  assert.ok(r.task);
  assert.equal(r.task!.duration, 5);
  assert.deepEqual(r.task!.tradeIds, ["t1"]);
  assert.equal(r.task!.stageId, "s1");
  assert.deepEqual(r.task!.dependencies, [{ taskId: "a", type: "FS", lag: 0 }]);
  assert.deepEqual(r.warnings, []);
});

test("hours become a day estimate and milestones 0 days; unknown names warn", () => {
  const h = buildQuickTask("Fræsning 4 timer @Elektriker", { trades, stages, tasks, hoursPerDay: 7.4, newId: "x" });
  assert.equal(h.task!.durationHours, 4);
  assert.equal(h.task!.duration, 1);
  assert.deepEqual(h.task!.tradeIds, ["t2"]);
  const m = buildQuickTask("Aflevering ms @Ukendt", { trades, stages, tasks, hoursPerDay: 7.4, newId: "x" });
  assert.equal(m.task!.duration, 0);
  assert.equal(m.task!.isMilestone, true);
  assert.equal(m.warnings.length, 1);
  assert.equal(buildQuickTask("   ", { trades, stages, tasks, hoursPerDay: 7.4, newId: "x" }).task, null);
});
