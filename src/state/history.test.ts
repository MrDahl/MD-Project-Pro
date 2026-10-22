import { test } from "node:test";
import assert from "node:assert/strict";
import { History } from "./history.ts";

test("undo and redo walk through recorded states", () => {
  const h = new History<number>();
  h.record(1); // 1 -> 2
  h.record(2); // 2 -> 3
  assert.equal(h.canUndo, true);
  assert.equal(h.undo(3), 2);
  assert.equal(h.undo(2), 1);
  assert.equal(h.undo(1), undefined);
  assert.equal(h.redo(1), 2);
  assert.equal(h.redo(2), 3);
  assert.equal(h.redo(3), undefined);
});

test("a new change clears the redo stack", () => {
  const h = new History<number>();
  h.record(1);
  h.undo(2);
  assert.equal(h.canRedo, true);
  h.record(1);
  assert.equal(h.canRedo, false);
});

test("edits with the same key within the window are one undo step", () => {
  const h = new History<string>();
  h.record("a", "title", 1000);
  h.record("ab", "title", 1500);
  h.record("abc", "title", 2000);
  assert.equal(h.undo("abcd"), "a"); // whole burst reverted at once
  assert.equal(h.canUndo, false);
});

test("a pause or another key starts a new step", () => {
  const h = new History<string>();
  h.record("a", "title", 1000);
  h.record("ab", "title", 5000); // too late
  h.record("abc", "other", 5100);
  assert.equal(h.undo("x"), "abc");
  assert.equal(h.undo("abc"), "ab");
  assert.equal(h.undo("ab"), "a");
});

test("history is capped", () => {
  const h = new History<number>(3);
  for (let i = 0; i < 10; i++) h.record(i);
  assert.equal(h.undo(10), 9);
  assert.equal(h.undo(9), 8);
  assert.equal(h.undo(8), 7);
  assert.equal(h.undo(7), undefined);
});

test("version changes whenever the stacks change", () => {
  const h = new History<number>();
  const v0 = h.version;
  h.record(1);
  const v1 = h.version;
  h.undo(2);
  assert.ok(v1 > v0 && h.version > v1);
});
