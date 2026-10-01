"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import { CalenderIcon } from "@/icons";

type Props = {
  id: string;
  label?: ReactNode;
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable date, "YYYY-MM-DD" */
  minDate?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

/**
 * Calendar date selection (flatpickr) — the value is picked from the calendar, not typed.
 * Controlled: emits "YYYY-MM-DD" strings.
 */
export function DateSelect({
  id,
  label,
  value,
  onChange,
  minDate,
  placeholder = "Select date",
  required,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      // Single input (no altInput, which adds a second field) showing a readable date
      dateFormat: "M j, Y",
      monthSelectorType: "static",
      disableMobile: true,
      onChange: (dates, _str, instance) =>
        onChangeRef.current(dates[0] ? instance.formatDate(dates[0], "Y-m-d") : ""),
    });
    fpRef.current = fp;
    return () => {
      fp.destroy();
      fpRef.current = null;
    };
  }, []);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    const current = fp.selectedDates[0] ? fp.formatDate(fp.selectedDates[0], "Y-m-d") : "";
    if (current !== value) fp.setDate(value || [], false, "Y-m-d");
  }, [value]);

  useEffect(() => {
    fpRef.current?.set("minDate", minDate || undefined);
  }, [minDate]);

  return (
    <div>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          readOnly
          className="h-10 w-full cursor-pointer rounded-lg border border-gray-200 bg-transparent px-3 pr-10 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-white dark:placeholder:text-white/30"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
          <CalenderIcon className="size-5" />
        </span>
      </div>
    </div>
  );
}
