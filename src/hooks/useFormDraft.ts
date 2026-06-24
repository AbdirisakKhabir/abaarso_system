"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DRAFT_PREFIX = "form_draft:";

type UseFormDraftOptions<T> = {
  /** Debounce delay before writing to localStorage (ms). */
  debounceMs?: number;
  /** When false, skip auto-save (e.g. after successful submit). */
  enabled?: boolean;
  /** Called once when a saved draft is restored on mount. */
  onRestored?: (draft: T) => void;
};

/**
 * Persists form state to localStorage so data survives refresh or brief network loss.
 */
export function useFormDraft<T extends Record<string, unknown>>(
  key: string,
  initial: T,
  options?: UseFormDraftOptions<T>
) {
  const debounceMs = options?.debounceMs ?? 500;
  const enabled = options?.enabled !== false;
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const restoredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [values, setValues] = useState<T>(initial);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as T;
      setValues(parsed);
      setHasDraft(true);
      options?.onRestored?.(parsed);
    } catch {
      localStorage.removeItem(storageKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next: T) => {
      if (!enabled || typeof window === "undefined") return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
          setHasDraft(true);
        } catch {
          /* quota exceeded — ignore */
        }
      }, debounceMs);
    },
    [storageKey, debounceMs, enabled]
  );

  const setField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setAll = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValues((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        persist(resolved);
        return resolved;
      });
    },
    [persist]
  );

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    setHasDraft(false);
    setValues(initial);
  }, [storageKey, initial]);

  const discardDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    setHasDraft(false);
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    values,
    setField,
    setAll,
    clearDraft,
    discardDraft,
    hasDraft,
  };
}
