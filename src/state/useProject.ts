import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "../types";
import { History } from "./history";
import { loadProject, saveProject } from "./project";

export interface UpdateOptions {
  /** Edits with the same key in quick succession become one undo step (e.g. typing). */
  coalesceKey?: string;
  /** false = change the state without creating an undo step (automatic changes, later steps of a drag). */
  history?: boolean;
}

export interface SaveInfo {
  savedAt: number | null;
  failed: boolean;
}

type Updater = AppData | ((prev: AppData) => AppData);

/** The project, its undo/redo history and its (debounced) persistence in the browser. */
export function useProject() {
  const [state, setState] = useState<AppData>(loadProject);
  const [history] = useState(() => new History<AppData>());
  const stateRef = useRef(state);
  const [saveInfo, setSaveInfo] = useState<SaveInfo>({ savedAt: null, failed: false });

  const commit = useCallback((next: AppData) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const update = useCallback(
    (updater: Updater, opts: UpdateOptions = {}) => {
      const prev = stateRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next === prev) return;
      if (opts.history !== false) history.record(prev, opts.coalesceKey);
      commit(next);
    },
    [history, commit]
  );

  const undo = useCallback(() => {
    const prev = history.undo(stateRef.current);
    if (prev) commit(prev);
  }, [history, commit]);

  const redo = useCallback(() => {
    const next = history.redo(stateRef.current);
    if (next) commit(next);
  }, [history, commit]);

  // Save shortly after the last change, and always when the page is hidden or closed
  useEffect(() => {
    const id = window.setTimeout(() => {
      const ok = saveProject(state);
      setSaveInfo({ savedAt: ok ? Date.now() : null, failed: !ok });
    }, 400);
    return () => window.clearTimeout(id);
  }, [state]);

  useEffect(() => {
    const flush = () => saveProject(stateRef.current);
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return {
    state,
    update,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    historyVersion: history.version,
    getHistoryVersion: () => history.version,
    saveInfo,
  };
}
