import { useEffect, useState } from "react";

/** useState that remembers its value in localStorage (view settings only, not project data). */
export function usePersistedState<T>(key: string, initial: T, parse: (raw: unknown) => T | undefined = (r) => r as T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const v = parse(JSON.parse(raw));
        if (v !== undefined) return v;
      }
    } catch {
      /* ignore */
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue];
}
