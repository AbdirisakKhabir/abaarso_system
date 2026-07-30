"use client";

import React from "react";
import { DEFAULT_PROGRAM, PROGRAMS, programLabel, type Program } from "@/lib/program";

type Props = {
  value: Program;
  onChange: (program: Program) => void;
  className?: string;
  id?: string;
};

/** Shared Program (Bachelor / Masters) filter for report pages. */
export function ReportProgramFilter({
  value,
  onChange,
  className,
  id = "report-program-filter",
}: Props) {
  return (
    <select
      id={id}
      value={value || DEFAULT_PROGRAM}
      onChange={(e) => onChange((e.target.value as Program) || DEFAULT_PROGRAM)}
      className={
        className ||
        "h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:focus:border-brand-500/40"
      }
      aria-label="Program"
    >
      {PROGRAMS.map((p) => (
        <option key={p} value={p}>
          {programLabel(p)}
        </option>
      ))}
    </select>
  );
}
