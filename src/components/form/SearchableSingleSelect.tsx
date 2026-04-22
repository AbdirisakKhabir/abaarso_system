"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = {
  id: number;
  primary: string;
  secondary?: string;
};

type Props = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptySearchHint?: string;
  noOptionsHint?: string;
};

export default function SearchableSingleSelect({
  options,
  value,
  onChange,
  disabled = false,
  searchPlaceholder = "Type to search…",
  emptySearchHint = "No matches.",
  noOptionsHint = "No items available.",
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => String(o.id) === value),
    [options, value]
  );

  const query = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return [];
    return options.filter(
      (o) =>
        o.primary.toLowerCase().includes(query) ||
        (o.secondary && o.secondary.toLowerCase().includes(query))
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const inputClass =
    "h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-9 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40";

  function startChange() {
    onChange("");
    setQ("");
    setOpen(true);
    queueMicrotask(() => inputRef.current?.focus());
  }

  if (disabled) {
    return (
      <div className="pointer-events-none opacity-60">
        {selected ? (
          <div className="flex h-11 items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90">
            <span className="truncate">{selected.primary}</span>
          </div>
        ) : (
          <div className="flex h-11 items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-400 dark:border-gray-700">
            —
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {selected && !open ? (
        <div className="flex h-11 w-full items-center gap-2 rounded-lg border border-gray-200 bg-transparent px-3 dark:border-gray-700">
          <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-white/90">
            {selected.primary}
          </span>
          <button
            type="button"
            onClick={startChange}
            className="shrink-0 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className={inputClass}
            />
          </div>

          {open && (
            <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
              {options.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                  {noOptionsHint}
                </p>
              ) : !query ? (
                <p className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                  Type to search, then choose a row.
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                  {emptySearchHint}
                </p>
              ) : (
                <ul className="max-h-48 overflow-y-auto py-1">
                  {filtered.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onChange(String(o.id));
                          setQ("");
                          setOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-white/90 dark:hover:bg-white/5"
                      >
                        {o.primary}
                        {o.secondary ? (
                          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                            ({o.secondary})
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
