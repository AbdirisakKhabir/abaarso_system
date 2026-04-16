"use client";

import React from "react";
import { TRANSCRIPT_BRAND } from "@/lib/transcript-brand";

export type AttendanceSheetStudent = {
  studentId: number;
  studentIdStr: string;
  firstName: string;
  lastName: string;
  totalChecked: number;
  sheetMarksRaw: number;
  sheetMarksRounded: number;
  slots: (boolean | null)[];
  firstHalfTint: "none" | "warn";
  secondHalfTint: "none" | "warn";
  rowDanger: boolean;
};

type SheetMeta = {
  facultyLabel: string;
  courseLabel: string | null;
  lecturerName: string | null;
};

type Props = {
  semester: string;
  year: number;
  sheet: SheetMeta;
  students: AttendanceSheetStudent[];
};

const navy = "bg-[#153e75] text-white";
const maroon = "bg-[#9e0539] text-white";
const infoGrey = "bg-[#e8e8e8] text-gray-900";
const sectionBlue = "bg-[#153e75] text-white text-[11px] font-semibold";
const summaryBlue = "bg-[#2b5e9e] text-white text-[11px] font-semibold";

function CheckCell({
  state,
  tint,
  danger,
}: {
  state: boolean | null;
  tint: "none" | "warn";
  danger: boolean;
}) {
  const bg =
    danger
      ? "bg-[#fecdd3]"
      : tint === "warn"
        ? "bg-[#fff59d]"
        : "bg-white";
  if (state === null) {
    return (
      <td
        className={`attendance-sheet-cell border border-black px-0.5 py-1 text-center ${bg}`}
      >
        <span className="inline-block h-4 w-4 align-middle opacity-40">—</span>
      </td>
    );
  }
  return (
    <td
      className={`attendance-sheet-cell border border-black px-0.5 py-1 text-center ${bg}`}
    >
      <span
        className={`inline-flex h-4 w-4 items-center justify-center border border-gray-500 align-middle ${
          state ? "bg-gray-500 text-white" : "bg-white"
        }`}
        aria-hidden
      >
        {state ? "✓" : ""}
      </span>
    </td>
  );
}

export default function AttendanceSheetTable({
  semester,
  year,
  sheet,
  students,
}: Props) {
  const uni = `${TRANSCRIPT_BRAND.universityName.toUpperCase()}, BERBERA`;
  const weeks = [1, 2, 3, 4, 5, 6] as const;

  return (
    <div className="attendance-sheet overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 print:overflow-visible print:border-0 print:p-0 dark:border-gray-600 dark:bg-white">
      <table className="w-full min-w-[920px] border-collapse font-[Arial,Helvetica,sans-serif] text-xs print:min-w-0">
        <thead>
          <tr>
            <td
              colSpan={18}
              className={`${navy} border border-black px-2 py-2 text-center text-sm font-bold uppercase tracking-wide print:text-[11px]`}
            >
              {uni}
            </td>
          </tr>
          <tr>
            <td
              colSpan={18}
              className={`${maroon} border border-black px-2 py-1.5 text-center text-sm font-bold uppercase print:text-[11px]`}
            >
              Attendance sheet
            </td>
          </tr>
          <tr>
            <td
              colSpan={9}
              className={`${infoGrey} border border-black px-2 py-1.5 text-left text-[11px] font-medium`}
            >
              {sheet.facultyLabel}
            </td>
            <td
              colSpan={9}
              className={`${infoGrey} border border-black px-2 py-1.5 text-left text-[11px] font-medium`}
            >
              COURSE: {sheet.courseLabel ?? "—"}
            </td>
          </tr>
          <tr>
            <td
              colSpan={9}
              className={`${infoGrey} border border-black px-2 py-1.5 text-left text-[11px] font-medium`}
            >
              {semester.toUpperCase()} ({year})
            </td>
            <td
              colSpan={9}
              className={`${infoGrey} border border-black px-2 py-1.5 text-left text-[11px] font-medium`}
            >
              LECTURER: {sheet.lecturerName ?? "—"}
            </td>
          </tr>
          <tr>
            <th
              rowSpan={2}
              className={`${sectionBlue} border border-black px-1 py-1.5`}
            >
              NO
            </th>
            <th
              rowSpan={2}
              className={`${sectionBlue} border border-black px-1 py-1.5 text-left`}
            >
              ID Card
            </th>
            <th
              rowSpan={2}
              className={`${sectionBlue} border border-black px-1 py-1.5 text-left`}
            >
              Name
            </th>
            <th colSpan={6} className={`${sectionBlue} border border-black py-1.5`}>
              First half semester
            </th>
            <th colSpan={6} className={`${sectionBlue} border border-black py-1.5`}>
              Second half semester
            </th>
            <th
              rowSpan={2}
              className={`${summaryBlue} border border-black px-1 py-1.5`}
            >
              Total
              <br />
              Classes
            </th>
            <th colSpan={2} className={`${summaryBlue} border border-black py-1.5`}>
              Marks
            </th>
          </tr>
          <tr>
            {weeks.map((w) => (
              <th
                key={`a-${w}`}
                className={`${sectionBlue} border border-black px-0.5 py-1`}
              >
                W{w}
              </th>
            ))}
            {weeks.map((w) => (
              <th
                key={`b-${w}`}
                className={`${sectionBlue} border border-black px-0.5 py-1`}
              >
                W{w}
              </th>
            ))}
            <th className={`${summaryBlue} border border-black px-0.5 py-1`}>
              Raw
            </th>
            <th className={`${summaryBlue} border border-black px-0.5 py-1`}>
              1 d.p.
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((row, idx) => (
            <tr key={row.studentId}>
              <td className="attendance-sheet-cell border border-black bg-white px-1 py-1 text-center font-medium text-gray-900">
                {idx + 1}
              </td>
              <td className="attendance-sheet-cell border border-black bg-white px-1 py-1 text-left font-mono text-[11px] text-gray-900">
                {row.studentIdStr}
              </td>
              <td className="attendance-sheet-cell border border-black bg-white px-1 py-1 text-left font-medium text-gray-900">
                {row.firstName} {row.lastName}
              </td>
              {row.slots.slice(0, 6).map((st, i) => (
                <CheckCell
                  key={`f-${row.studentId}-${i}`}
                  state={st}
                  tint={row.firstHalfTint}
                  danger={row.rowDanger}
                />
              ))}
              {row.slots.slice(6, 12).map((st, i) => (
                <CheckCell
                  key={`s-${row.studentId}-${i}`}
                  state={st}
                  tint={row.secondHalfTint}
                  danger={row.rowDanger}
                />
              ))}
              <td
                className={`attendance-sheet-cell border border-black px-1 py-1 text-center font-medium text-gray-900 ${
                  row.rowDanger ? "bg-[#fecdd3]" : "bg-white"
                }`}
              >
                {row.totalChecked}
              </td>
              <td
                className={`attendance-sheet-cell border border-black px-1 py-1 text-center font-mono text-[11px] text-gray-900 ${
                  row.rowDanger ? "bg-[#fecdd3]" : "bg-white"
                }`}
              >
                {row.sheetMarksRaw.toFixed(9)}
              </td>
              <td
                className={`attendance-sheet-cell border border-black px-1 py-1 text-center font-semibold text-gray-900 ${
                  row.rowDanger ? "bg-[#fecdd3]" : "bg-white"
                }`}
              >
                {row.sheetMarksRounded.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-gray-500 print:text-[9px]">
        Present or excused counts as attended. Marks = (Total classes ÷ 12) × 10.
        Up to twelve sessions fill W1–W6 (first half) then W1–W6 (second half), in
        chronological order.
      </p>
    </div>
  );
}
