import type { Task } from "../types.ts";

/** Removes calculated fields so a task can be stored as plain input data. */
export function stripCalculated(task: Task): Task {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { calcStart, calcEnd, calcCost, isCritical, tradeCosts, assignmentCosts, roleCosts, roleHours, occurrences, ...rest } = task;
  return rest;
}
