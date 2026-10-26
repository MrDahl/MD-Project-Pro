import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPlan } from "./planCheck.ts";
import type { Task, Trade } from "../types.ts";

const trade = { id: "tr", name: "Maler", color: "#000", roles: [] } as unknown as Trade;
const mk = (id: string, extra: Partial<Task> = {}): Task =>
  ({ id, title: id, tradeIds: ["tr"], duration: 2, calcStart: "2026-03-02", calcEnd: "2026-03-03", calcCost: 1000, dependencies: [], dependencyId: null, ...extra }) as unknown as Task;

test("empty plan gets a friendly single item", () => {
  const r = checkPlan([], [], [], []);
  assert.equal(r.items.length, 1);
  assert.equal(r.passed, 0);
});

test("a tidy plan passes every check", () => {
  const tasks = [
    mk("a"),
    mk("b", { dependencies: [{ taskId: "a", type: "FS", lag: 0 }], dependencyId: "a" }),
    mk("c", { dependencies: [{ taskId: "b", type: "FS", lag: 0 }], dependencyId: "b", isCritical: true }),
    mk("m", { isMilestone: true, tradeIds: [], dependencies: [{ taskId: "c", type: "FS", lag: 0 }], dependencyId: "c" }),
  ];
  const r = checkPlan(tasks, [trade], [], []);
  assert.equal(r.passed, r.total, JSON.stringify(r.items.filter((i) => i.level === "warn")));
});

test("flags missing trade, zero price, loose tasks and double booking", () => {
  const tasks = [mk("a", { tradeIds: [] }), mk("b", { calcCost: 0 }), mk("c"), mk("d"), mk("e"), mk("f")];
  const warnings = [{ id: "w", kind: "double-booking", taskIds: ["c", "d"], message: "x" }] as never;
  const r = checkPlan(tasks, [trade], [], warnings);
  const level = (id: string) => r.items.find((i) => i.id === id)!.level;
  assert.equal(level("trade"), "warn");
  assert.equal(level("price"), "warn");
  assert.equal(level("links"), "warn");
  assert.equal(level("booking"), "warn");
  assert.equal(r.items.find((i) => i.id === "booking")!.taskId, "c");
  assert.ok(r.passed < r.total);
});
