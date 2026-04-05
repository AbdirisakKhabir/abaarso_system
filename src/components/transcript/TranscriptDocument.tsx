"use client";

import React from "react";
import Button from "@/components/ui/button/Button";
import { TRANSCRIPT_BRAND, GRADING_SYSTEM_LEGEND } from "@/lib/transcript-brand";

/** Brand palette for transcript accents */
const BRAND_PRIMARY = "#a1133f";
const SEMESTER_BAND_BG = "#f2c9d5";

/** Compact table cells so a full 9-semester transcript fits ~2 printed pages */
const cellBorder =
  "border border-black px-1 py-0.5 text-[10px] leading-tight print:text-[9px] print:leading-tight";
const tableHeaderCell = `${cellBorder} bg-white font-bold text-black`;

type ExamRecord = {
  id: number;
  semester: string;
  year: number;
  totalMarks: number;
  grade: string | null;
  gradePoints: number | null;
  course: { code: string; name: string; creditHours: number };
};

type StudentInfo = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  admissionDate?: string | Date;
  department?: {
    id: number;
    name: string;
    code: string;
    faculty?: { id: number; name: string; code: string };
  };
};

type SemesterGPA = {
  semester: string;
  year: number;
  gpa: number;
  totalCredits: number;
  totalGradePoints: number;
  courses: number;
};

type TranscriptDocumentProps = {
  student: StudentInfo;
  recordsBySemester: Record<string, ExamRecord[]>;
  semesterKeys: string[];
  semGpaMap: Record<string, SemesterGPA>;
  cumulativeGPA: number;
  totalCredits: number;
  semOrder?: Record<string, number>;
  /** Show a Print Transcript button above the document (hidden when printing) */
  showPrintButton?: boolean;
};

function formatSemesterLabel(semester: string): string {
  const m = String(semester).match(/(\d+)/);
  if (m) return `Semester ${m[1]}`;
  const t = String(semester).trim();
  return t.length > 0 ? t : "—";
}

function isFailingMark(totalMarks: number, grade: string | null): boolean {
  if (Number.isFinite(totalMarks) && totalMarks < 50) return true;
  return (grade || "").toUpperCase() === "F";
}

export function TranscriptDocument({
  student,
  recordsBySemester,
  semesterKeys,
  semGpaMap,
  cumulativeGPA,
  totalCredits,
  showPrintButton = false,
}: TranscriptDocumentProps) {
  const college = student.department?.faculty?.name ?? "—";
  const department = student.department?.name ?? "—";
  const studentName = `${student.firstName} ${student.lastName}`;
  const entryYear = student.admissionDate
    ? new Date(student.admissionDate).getFullYear()
    : "—";

  const legendHeading = `${TRANSCRIPT_BRAND.gradingSystemTitle.endsWith(":") ? TRANSCRIPT_BRAND.gradingSystemTitle.slice(0, -1) : TRANSCRIPT_BRAND.gradingSystemTitle}:`;

  const semesterBandStyle = {
    backgroundColor: SEMESTER_BAND_BG,
    color: BRAND_PRIMARY,
  };

  const courseCodeHeaderClass = `${cellBorder} bg-[#a1133f] text-left font-bold text-white print:bg-[#a1133f] print:text-white`;
  const courseCodeCellClass = `${cellBorder} bg-[#a1133f] font-mono font-semibold text-white print:bg-[#a1133f] print:text-white`;

  return (
    <div className="transcript-print-root">
      {showPrintButton && (
        <div className="no-print mb-4 flex justify-end">
          <Button type="button" size="sm" onClick={() => window.print()}>
            Print Transcript
          </Button>
        </div>
      )}
      <div
        className="transcript-document mx-auto max-w-[210mm] bg-white px-4 py-3 font-[Arial,Helvetica,sans-serif] text-[10px] text-black print:px-3 print:py-2 print:text-[9px]"
        style={{ color: "#000" }}
      >
        {/* Header: logo top-left, title block centered */}
        <div className="relative mb-3 min-h-16 print:mb-2 print:min-h-14">
          <div className="absolute left-0 top-0 h-16 w-16 shrink-0 overflow-hidden print:h-12 print:w-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={TRANSCRIPT_BRAND.logoUrl}
              alt="University logo"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div className="px-14 text-center print:px-12">
            <h1 className="text-lg font-bold uppercase tracking-tight print:text-sm">
              {TRANSCRIPT_BRAND.universityName}
            </h1>
            <p className="mt-0.5 text-[11px] italic print:text-[9px]">
              E-mail Address: {TRANSCRIPT_BRAND.email}, Website: {TRANSCRIPT_BRAND.website}
            </p>
            <p className="mt-1 text-[11px] font-bold print:text-[9px]">{TRANSCRIPT_BRAND.officeTitle}</p>
            <div className="my-2 border-t border-black print:my-1.5" />
            <h2 className="text-sm font-bold print:text-[10px]">{TRANSCRIPT_BRAND.documentTitle}</h2>
          </div>
        </div>

        {/* Student info + Grading system */}
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start print:mb-1.5 print:gap-2">
          <table
            className="transcript-table flex-1 border border-black text-[10px] print:text-[9px]"
            style={{ borderCollapse: "collapse" }}
          >
            <tbody>
              {(
                [
                  ["College", college],
                  ["Department", department],
                  ["Student Name", studentName],
                  ["Student ID", student.studentId],
                  ["Entry Year", String(entryYear)],
                ] as const
              ).map(([label, value]) => (
                <tr key={label}>
                  <td className={`${cellBorder} w-[28%] font-semibold`}>{label}</td>
                  <td className={`${cellBorder} ${label === "Student ID" ? "font-mono" : ""}`}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <table
            className="transcript-table w-full shrink-0 border border-black text-[10px] sm:w-44 print:text-[9px]"
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th colSpan={2} className={`${tableHeaderCell} text-left`}>
                  {legendHeading}
                </th>
              </tr>
              <tr>
                <th className={`${tableHeaderCell} text-center font-semibold`}>
                  Percentage Score
                </th>
                <th className={`${tableHeaderCell} text-center font-semibold`}>
                  Grade
                </th>
              </tr>
            </thead>
            <tbody>
              {GRADING_SYSTEM_LEGEND.map(({ range, grade }) => (
                <tr key={`${range}-${grade}`}>
                  <td className={cellBorder}>{range}</td>
                  <td className={`${cellBorder} text-center font-semibold`}>{grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Semesters */}
        {semesterKeys.map((key, keyIdx) => {
          const [year, semester] = key.split("-");
          const records = recordsBySemester[key] || [];
          const semGpa = semGpaMap[key];
          const prevKeys = semesterKeys.slice(0, keyIdx);
          let cumCredits = 0;
          let cumHpts = 0;
          for (const pk of prevKeys) {
            const pr = recordsBySemester[pk] || [];
            for (const r of pr) {
              cumCredits += r.course.creditHours;
              cumHpts += r.course.creditHours * (r.gradePoints ?? 0);
            }
          }
          const thisSemCredits = records.reduce((s, r) => s + r.course.creditHours, 0);
          const thisSemHpts = records.reduce(
            (s, r) => s + r.course.creditHours * (r.gradePoints ?? 0),
            0
          );
          const totalCreditsSoFar = cumCredits + thisSemCredits;
          const totalHptsSoFar = cumHpts + thisSemHpts;
          const cgpa =
            totalCreditsSoFar > 0
              ? Math.round((totalHptsSoFar / totalCreditsSoFar) * 100) / 100
              : 0;

          const yearEnd = Number(year);
          const yearStart = yearEnd - 1;

          return (
            <div
              key={key}
              className="transcript-semester-block mb-2 last:mb-1 print:mb-1.5"
            >
              <div
                className="transcript-semester-band px-2 py-1 text-[11px] font-bold leading-tight print:text-[10px] print:py-0.5"
                style={semesterBandStyle}
              >
                Academic Year: {yearStart}-{yearEnd}
                <span className="mx-1.5 opacity-80">·</span>
                {formatSemesterLabel(semester)}
              </div>

              <table
                className="transcript-table mt-0 w-full border border-black text-[10px] print:text-[9px]"
                style={{ borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <th rowSpan={2} className={courseCodeHeaderClass}>
                      Course Code
                    </th>
                    <th rowSpan={2} className={`${tableHeaderCell} text-left`}>
                      Course Title
                    </th>
                    <th rowSpan={2} className={`${tableHeaderCell} w-8 text-center`}>
                      CrHrs
                    </th>
                    <th colSpan={3} className={`${tableHeaderCell} text-center`}>
                      Grades
                    </th>
                  </tr>
                  <tr>
                    {(["Marks", "Grade", "GPA"] as const).map((h) => (
                      <th key={h} className={`${tableHeaderCell} w-9 text-center`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const fail = isFailingMark(r.totalMarks, r.grade);
                    const markStyle = fail
                      ? {
                          backgroundColor: TRANSCRIPT_BRAND.failGradeBg,
                          color: TRANSCRIPT_BRAND.failGradeText,
                        }
                      : undefined;
                    return (
                      <tr key={r.id} className="transcript-row bg-white">
                        <td className={courseCodeCellClass}>{r.course.code}</td>
                        <td className={`${cellBorder} text-left`}>{r.course.name}</td>
                        <td className={`${cellBorder} text-center`}>{r.course.creditHours}</td>
                        <td className={`${cellBorder} text-center`} style={markStyle}>
                          {r.totalMarks.toFixed(2)}
                        </td>
                        <td className={`${cellBorder} text-center font-semibold`} style={markStyle}>
                          {r.grade || "—"}
                        </td>
                        <td className={`${cellBorder} text-center`}>
                          {r.gradePoints != null ? r.gradePoints.toFixed(2) : "0.00"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className={`${cellBorder} font-semibold`}>
                      Total
                    </td>
                    <td className={`${cellBorder} text-center font-bold`}>{thisSemCredits}</td>
                    <td className={cellBorder} />
                    <td className={cellBorder} />
                    <td className={cellBorder} />
                  </tr>
                </tfoot>
              </table>

              <div className="transcript-semester-gpa mt-0.5 flex flex-wrap items-baseline justify-end gap-x-4 gap-y-0 text-[10px] font-semibold print:text-[9px]">
                <span>
                  GPA: <span className="font-bold">{semGpa?.gpa.toFixed(2) ?? "0.00"}</span>
                </span>
                {keyIdx > 0 && (
                  <span>
                    CGPA: <span className="font-bold">{cgpa.toFixed(2)}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div className="mt-2 border-t border-black pt-1.5 print:mt-1.5 print:pt-1">
          <p className="text-[10px] font-bold print:text-[9px]">
            Cumulative GPA: <span className="text-[11px] font-bold print:text-[10px]">{cumulativeGPA.toFixed(2)}</span>
          </p>
          <p className="text-[10px] print:text-[9px]">Total Credits: {totalCredits}</p>
          <p className="mt-0.5 text-[9px] text-gray-700 print:text-[8px]">
            Generated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="mt-3 flex justify-end print:mt-2">
          <div className="w-40 text-right">
            <div className="mb-0.5 h-px border-t-2 border-black" />
            <p className="text-[10px] font-bold text-gray-900 print:text-[9px]">
              {TRANSCRIPT_BRAND.officeTitle}
            </p>
            <p className="text-[9px] text-gray-600 print:text-[8px]">Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
