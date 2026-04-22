"use client";

import React, { useMemo, useState } from "react";

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
  searchPlaceholder = "Search by code or name…",
  emptySearchHint = "No matches.",
  noOptionsHint = "No items available.",
}: Props) {
  const [q, setQ] = useState("");

  const selected = useMemo(
    () => options.find((o) => String(o.id) === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(
      (o) =>
        o.primary.toLowerCase().includes(s) ||
        (o.secondary && o.secondary.toLowerCase().includes(s))
    );
  }, [options, q]);

  const inputClass =
    "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white";

  return (
    <div
      className={
        disabled ? "pointer-events-none opacity-60" : undefined
      }
    >
      {selected ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 text-sm dark:border-brand-500/35 dark:bg-brand-500/10">
          <span className="min-w-0 font-medium text-gray-800 dark:text-white/90">
            {selected.primary}
            {selected.secondary ? (
              <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                {selected.secondary}
              </span>
            ) : null}
          </span>
          {!disabled ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-500/20"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          disabled={disabled}
          autoComplete="off"
          className={inputClass}
        />
      </div>

      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30">
        {options.length === 0 ? (
          <p className="p-3 text-xs text-gray-500 dark:text-gray-400">{noOptionsHint}</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-xs text-gray-500 dark:text-gray-400">{emptySearchHint}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {filtered.map((o) => {
              const isOn = String(o.id) === value;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(String(o.id));
                      setQ("");
                    }}
                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white dark:hover:bg-gray-800/80 ${
                      isOn
                        ? "bg-brand-50/90 dark:bg-brand-500/15"
                        : "bg-transparent"
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        isOn ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-gray-800 dark:text-white/90">
                        {o.primary}
                      </span>
                      {o.secondary ? (
                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                          {o.secondary}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
