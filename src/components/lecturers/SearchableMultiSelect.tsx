"use client";

import React, { useMemo, useState } from "react";

export type SearchableOption = { id: number; primary: string; secondary?: string };

type Props = {
  label: string;
  options: SearchableOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  searchPlaceholder?: string;
  emptyHint?: string;
};

export default function SearchableMultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  searchPlaceholder = "Search…",
  emptyHint = "No matches.",
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(
      (o) =>
        o.primary.toLowerCase().includes(s) ||
        (o.secondary && o.secondary.toLowerCase().includes(s))
    );
  }, [options, q]);

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const selectedOptions = options.filter((o) => selectedIds.includes(o.id));

  const inputClass =
    "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white";

  return (
    <div className="space-y-2">
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-brand-200 bg-brand-50/50 p-2 dark:border-brand-500/30 dark:bg-brand-500/10">
          {selectedOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-brand-800 shadow-sm ring-1 ring-brand-200 transition hover:bg-brand-100 dark:bg-gray-800 dark:text-brand-200 dark:ring-brand-500/40 dark:hover:bg-gray-700"
            >
              <span>{o.primary}</span>
              {o.secondary && <span className="text-gray-500 dark:text-gray-400">· {o.secondary}</span>}
              <span className="text-brand-500" aria-hidden>
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className={inputClass}
          autoComplete="off"
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30">
        {options.length === 0 ? (
          <p className="p-3 text-xs text-gray-500 dark:text-gray-400">No items available.</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-xs text-gray-500 dark:text-gray-400">{emptyHint}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {filtered.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-white dark:hover:bg-gray-800/80">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(o.id)}
                    onChange={() => toggle(o.id)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-gray-800 dark:text-white/90">{o.primary}</span>
                    {o.secondary && (
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{o.secondary}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
