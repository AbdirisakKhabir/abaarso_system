"use client";

import React, { type ReactNode } from "react";

export type DateInputProps = {
  id: string;
  /** When set, associates label with the input */
  label?: ReactNode;
  labelClassName?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  name?: string;
  className?: string;
  /** Full class string for the `<input>`; overrides default styling when provided */
  inputClassName?: string;
  "aria-label"?: string;
};

const defaultLabelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

const defaultInputClass =
  "h-10 w-full min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none transition-[color,box-shadow] focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500/40 [color-scheme:light] dark:[color-scheme:dark]";

/**
 * Native date picker (`type="date"`) with consistent styling — opens the browser/OS calendar for selection.
 */
export function DateInput({
  id,
  label,
  labelClassName,
  value,
  onChange,
  required,
  disabled,
  min,
  max,
  name,
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: DateInputProps) {
  const inputCls = inputClassName ?? defaultInputClass;

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className={labelClassName ?? defaultLabelClass}>
          {label}
        </label>
      ) : null}
      <input
        id={id}
        name={name}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        aria-label={ariaLabel}
        className={inputCls}
      />
    </div>
  );
}

export default DateInput;
