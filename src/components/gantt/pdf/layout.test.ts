import { test } from "node:test";
import assert from "node:assert/strict";
import type { Stage, Task, Trade } from "../../../types.ts";
import { buildCalendar, calculateSchedule } from "../../../utils/scheduler.ts";
import { withLinks } from "../../../utils/links.ts";
import { makeBaseline } from "../../../utils/baseline.ts";
import { DEFAULT_PDF_OPTIONS, MAX_PAGE_MM, PAPER_MM, chunkRows, isoWeek, latin1, layoutPages, selectRows, tint, type PdfInput, type PdfOptions } from "./layout.ts";

const trades: Trade[] = [
  { id: "m", name: "Murer", rate: 400, isFixedPrice: false, weekendSupplement: 0, holidaySupplement: 0, color: "#2563eb" },
  { id: "t", name: "Tømrer", rate: 400, isFixedPrice: false, weekendSupplement: 0, holidaySupplement: 0, color: "#16a34a" },
];
const stages: Stage[] = [
  { id: "s1", name: "Råhus", color: "#b45309", startDate: "2026-06-22", endDate: "2027-12-31" },
  { id: "s2", name: "Finish", color: "#0369a1", startDate: "2027-01-01", endDate: "2027-12-31" },
];

function makeInput(n: number, withBaseline = false): PdfInput {
  const tasks: Task[] = [];
  for (let i = 0; i < n; i++) {
    const base: Task = { id: `t${i}`, title: `Opgave ${i} æøå`, desc: "", duration: 2 + (i % 4), manualStart: null, tradeIds: i % 5 === 0 ? ["m", "t"] : ["m"], dependencyId: null, allowWeekend: false, allowHoliday: false, stageId: i < n / 2 ? "s1" : "s2", progress: i % 3 === 0 ? 50 : 0 };
    if (i === 3) base.isMilestone = true;
    tasks.push(i > 0 && i % 7 !== 0 ? withLinks(base, [{ taskId: `t${i - 1}`, type: i % 4 === 0 ? "SS" : "FS", lag: 0 }]) : base);
  }
  const holidays = [{ id: "h", date: "2026-06-24", name: "Ferie" }];
  const r = calculateSchedule(tasks, trades, holidays, { workHoursPerDay: 7.4 }, "2026-06-22", stages, [{ id: "w", label: "Frost", startDate: "2026-07-01", endDate: "2026-07-02" }]);
  const cal = buildCalendar(holidays, [{ id: "w", label: "Frost", startDate: "2026-07-01", endDate: "2026-07-02" }]);
  return {
    tasks: r.tasks, trades, stages, cal, weatherRanges: cal.weatherRanges,
    baseline: withBaseline ? makeBaseline(r.tasks.map((t) => ({ ...t, calcEnd: t.calcEnd })), r.projectEndDate, r.projectTotalCost) : null,
    projectInfo: { projectName: "Testprojekt", address: "Vej 1", customer: "Kunde", manager: "Leder" },
    today: Math.floor(Date.UTC(2026, 6, 10) / 86_400_000),
    printedAt: new Date("2026-10-23T10:00:00"),
  };
}
const opts = (o: Partial<PdfOptions> = {}): PdfOptions => ({ ...DEFAULT_PDF_OPTIONS, ...o });
const texts = (page: { prims: { k: string }[] }) => page.prims.filter((p): p is { k: "text"; s: string } & typeof p => p.k === "text").map((p) => p.s);

test("helpers: latin1, tint, isoWeek", () => {
  assert.equal(latin1("Æble – 5→6 … ✓"), "Æble - 5->6 ... ?");
  assert.equal(tint("#000000", 0), "#ffffff");
  assert.equal(tint("#ff0000", 1), "#ff0000");
  assert.equal(isoWeek(Math.floor(Date.UTC(2026, 5, 22) / 86_400_000)), 26);
  assert.equal(isoWeek(Math.floor(Date.UTC(2027, 0, 1) / 86_400_000)), 53);
});

test("one page for a normal project, with title, calendar, labels and legend", () => {
  const pages = layoutPages(makeInput(40), opts());
  assert.equal(pages.length, 1);
  const t = texts(pages[0]);
  assert.ok(t.includes("Testprojekt"));
  assert.ok(t.some((s) => s.startsWith("1. Opgave 0 æøå")), "task label with number and title");
  assert.ok(t.some((s) => s.includes("Murer, Tømrer")), "trade names next to the task");
  assert.ok(t.some((s) => s.includes("Juni 2026") || s.includes("jun")), "month header");
  assert.ok(t.some((s) => /^u\d+$/.test(s)), "week header");
  assert.ok(t.includes("Faggrupper:") && t.includes("Murer") && t.includes("Tømrer"), "legend");
  assert.ok(t.includes("Side 1 af 1".replace("Side", "Opgaver: 40 af 40   |   Side")) || t.some((s) => s.includes("Opgaver: 40 af 40")));
  assert.equal(pages[0].taskCount, 40);
});

test("max 300 tasks per page: 650 tasks give 3 pages, nothing lost", () => {
  const pages = layoutPages(makeInput(650), opts({ maxTasks: 300 }));
  assert.equal(pages.length, 3);
  assert.deepEqual(pages.map((p) => p.taskCount), [300, 300, 50]);
  assert.equal(pages.reduce((a, p) => a + p.taskCount, 0), 650);
  assert.ok(texts(pages[1]).some((s) => s.includes("(FORTSAT)")), "stage heading repeated on continuation page");
});

test("every page stays inside the PDF size limit and primitives inside the page", () => {
  for (const [n, dayWidth] of [[300, 5], [650, 12]] as const) {
    for (const p of layoutPages(makeInput(n), opts({ dayWidth }))) {
      assert.ok(p.w <= MAX_PAGE_MM + 1e-6 && p.h <= MAX_PAGE_MM + 1e-6, `${p.w} x ${p.h}`);
      for (const pr of p.prims) {
        if (pr.k === "rect") assert.ok(pr.x >= -0.01 && pr.y >= -0.01 && pr.x + pr.w <= p.w + 0.01 && pr.y + pr.h <= p.h + 0.01, JSON.stringify(pr));
        if (pr.k === "line") assert.ok(pr.x1 >= -0.01 && pr.x2 <= p.w + 0.01 && pr.y1 >= -0.01 && pr.y2 <= p.h + 0.01);
      }
    }
  }
});

test("one stage at a time: only that stage's tasks, range limited to it", () => {
  const input = makeInput(40);
  const all = selectRows(input, "all");
  const one = selectRows(input, "s2");
  assert.equal(one.taskCount, 20);
  assert.ok(one.rows.every((r) => r.kind !== "task" || r.task.stageId === "s2"));
  assert.ok(one.maxDay - one.minDay < all.maxDay - all.minDay + 1);
  const pages = layoutPages(input, opts({ scope: "s2" }));
  assert.equal(pages.length, 1);
  assert.ok(texts(pages[0]).includes("Etape: Finish"));
});

test("fixed paper: exact size, scaled to fit, more rows than fit continue on the next page", () => {
  const [w, h] = PAPER_MM.A3;
  const pages = layoutPages(makeInput(120), opts({ paper: "A3" }));
  assert.ok(pages.length > 1);
  for (const p of pages) {
    assert.equal(p.w, w);
    assert.equal(p.h, h);
  }
  assert.equal(pages.reduce((a, p) => a + p.taskCount, 0), 120);
  const portrait = layoutPages(makeInput(10), opts({ paper: "A4", portrait: true }));
  assert.deepEqual([portrait[0].w, portrait[0].h], [210, 297]);
});

test("baseline and arrows can be switched off", () => {
  const input = makeInput(30, true);
  const withAll = layoutPages(input, opts())[0];
  const without = layoutPages(input, opts({ arrows: false, baseline: false }))[0];
  assert.ok(texts(withAll).includes("Baseline (oprindelig plan)"));
  assert.ok(!texts(without).includes("Baseline (oprindelig plan)"));
  assert.ok(withAll.prims.length > without.prims.length);
  assert.ok(!texts(without).includes("Afhængighed"));
});

test("empty selection still gives a page", () => {
  const input = makeInput(0);
  const pages = layoutPages(input, opts());
  assert.equal(pages.length, 1);
  assert.equal(pages[0].taskCount, 0);
});

test("chunkRows never leaves a stage heading as the last row", () => {
  const stage = stages[0];
  const task = (i: number) => ({ kind: "task" as const, task: { id: `x${i}` } as Task, number: i });
  const rows = [{ kind: "stage" as const, stage, cont: false }, task(1), task(2), { kind: "stage" as const, stage: stages[1], cont: false }, task(3)];
  const chunks = chunkRows(rows, 2, 99);
  assert.equal(chunks.length, 2);
  assert.notEqual(chunks[0][chunks[0].length - 1].kind, "stage");
  assert.equal(chunks[1][0].kind, "stage");
});
