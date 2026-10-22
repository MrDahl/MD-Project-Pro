/**
 * Undo/redo stack of immutable snapshots.
 * Edits that share a `key` within `coalesceMs` (e.g. typing in one text field) count as one undo step.
 */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;
  /** Increases on every change to the stacks; lets a toast know whether "undo" still targets its action. */
  version = 0;

  private readonly limit: number;
  private readonly coalesceMs: number;

  constructor(limit = 100, coalesceMs = 1500) {
    this.limit = limit;
    this.coalesceMs = coalesceMs;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Call with the state as it was *before* a change. */
  record(prev: T, key?: string, now: number = Date.now()): void {
    const coalesce = !!key && key === this.lastKey && now - this.lastAt < this.coalesceMs;
    if (!coalesce) {
      this.past.push(prev);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.lastKey = key ?? null;
    this.lastAt = now;
    this.future = [];
    this.version++;
  }

  undo(current: T): T | undefined {
    const prev = this.past.pop();
    if (prev === undefined) return undefined;
    this.future.push(current);
    this.lastKey = null;
    this.version++;
    return prev;
  }

  redo(current: T): T | undefined {
    const next = this.future.pop();
    if (next === undefined) return undefined;
    this.past.push(current);
    this.lastKey = null;
    this.version++;
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.lastKey = null;
    this.version++;
  }
}
