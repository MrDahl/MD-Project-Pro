import { test } from "node:test";
import assert from "node:assert/strict";
import { importFromText, parseDuration, parseTable } from "./pasteImport.ts";
import { applyBulk, deleteMany } from "./bulk.ts";
import { calculateSchedule } from "./scheduler.ts";
import { fitStageDates } from "./stages.ts";
import { taskLinks } from "./links.ts";
import type { Task, Trade } from "../types.ts";

const ctx = { trades: [] as Trade[], stages: [], startDate: "2026-06-22" };

test("parseTable: tabs, semicolons, quotes with line breaks", () => {
  assert.deepEqual(parseTable("a\tb\tc\n1\t2\t3"), [["a", "b", "c"], ["1", "2", "3"]]);
  assert.deepEqual(parseTable("a;b\n1;2\r\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseTable('"x ""y""";"l1\nl2"\n3;4'), [['x "y"', "l1\nl2"], ["3", "4"]]);
  assert.deepEqual(parseTable("\n\n"), []);
});

test("parseDuration understands days, weeks and decimals", () => {
  assert.equal(parseDuration("3", false), 3);
  assert.equal(parseDuration("2 uger", false), 10);
  assert.equal(parseDuration("2", true), 10);
  assert.equal(parseDuration("4 d", true), 4);
  assert.equal(parseDuration("1,5", false), 2);
  assert.equal(parseDuration("abc", false), null);
});

test("import with header, ids, multiple predecessors, trades and stages", () => {
  const text = [
    "ID\tOpgave\tVarighed (uger)\tForgænger(e)\tFag-kategori\tZone",
    "P01\tProjektstart\t2\t(ingen - projektstart)\tLedelse og bygherre\tOpstart",
    "P02\tRådgivning\t4\tP01\tRådgivere og projektering\tOpstart",
    "P03\tBygning\t8\tP01, P02SS+2\tTømrer\tZone 1",
    "P04\tAflevering\t0\tP03\t\tZone 1",
  ].join("\n");
  const r = importFromText(text, ctx);
  assert.equal(r.tasks.length, 4);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.tasks[0].duration, 10);
  assert.equal(r.tasks[0].dependencies?.length ?? 0, 0);
  assert.equal(r.newTrades.length, 3);
  assert.equal(r.newStages.length, 2);
  const links = taskLinks(r.tasks[2]);
  assert.deepEqual(links.map((l) => [l.taskId, l.type, l.lag]), [[r.tasks[0].id, "FS", 0], [r.tasks[1].id, "SS", 2]]);
  assert.equal(r.tasks[3].isMilestone, true);
  assert.equal(r.tasks[3].duration, 0);
  assert.equal(r.tasks[3].stageId, r.tasks[2].stageId);
  // It must be schedulable
  const plan = calculateSchedule(r.tasks, r.newTrades, [], { workHoursPerDay: 7.4 }, "2026-06-22", [], []);
  assert.equal(plan.scheduleError, null);
  assert.ok(plan.tasks.every((t) => t.calcStart));
  const stages = fitStageDates(r.tasks, r.newTrades, [], { workHoursPerDay: 7.4 }, "2026-06-22", r.newStages);
  assert.ok(stages[0].endDate > stages[0].startDate);
});

test("import without header uses the column order Titel, Varighed, Forgænger, Faggruppe, Etape; row numbers refer to rows", () => {
  const r = importFromText("Grave\t3\t\tJord\tEtape 1\nStøbe\t2\t1\tBeton\tEtape 1\nTørre\t5\tStøbe\tBeton\tEtape 1", {
    ...ctx,
    trades: [{ id: "tr-b", name: "beton", rate: 1, isFixedPrice: false, weekendSupplement: 0, holidaySupplement: 0, color: "#000" }],
  });
  assert.equal(r.tasks.length, 3);
  assert.equal(taskLinks(r.tasks[1])[0].taskId, r.tasks[0].id);
  assert.equal(taskLinks(r.tasks[2])[0].taskId, r.tasks[1].id); // by title
  assert.equal(r.newTrades.length, 1, "Beton matches the existing trade case-insensitively");
  assert.equal(r.tasks[1].tradeIds[0], "tr-b");
});

test("problems are reported, not thrown", () => {
  const r = importFromText("Opgave\tVarighed\tForgænger\tStart\nA\tx\tfindes ikke\t32/13/2026\n\t2\t\t\nB\t\t\t", ctx);
  assert.equal(r.tasks.length, 2);
  assert.ok(r.warnings.some((w) => /varigheden "x"/.test(w)));
  assert.ok(r.warnings.some((w) => /findes ikke/.test(w)));
  assert.ok(r.warnings.some((w) => /startdatoen/.test(w)));
  assert.ok(r.warnings.some((w) => /mangler opgavenavn/.test(w)));
  assert.ok(r.warnings.some((w) => /ingen varighed/.test(w)));
  assert.equal(importFromText("", ctx).tasks.length, 0);
  assert.equal(r.tasks[0].duration, 1);
});

test("start dates in Danish formats", () => {
  const r = importFromText("Opgave\tVarighed\tStart\nA\t1\t5/8/2026\nB\t1\t2026-09-01\nC\t1\t01.10.26", ctx);
  assert.deepEqual(r.tasks.map((t) => t.manualStart), ["2026-08-05", "2026-09-01", "2026-10-01"]);
});

test("a loop among pasted tasks drops the links", () => {
  const r = importFromText("ID\tOpgave\tVarighed\tForgænger\nA\tEn\t1\tB\nB\tTo\t1\tA", ctx);
  assert.ok(r.warnings.some((w) => /løkke/.test(w)));
  assert.ok(r.tasks.every((t) => taskLinks(t).length === 0));
});

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
