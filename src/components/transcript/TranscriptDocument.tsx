"use client";

import React from "react";
import Button from "@/components/ui/button/Button";
import { TRANSCRIPT_BRAND, GRADING_SYSTEM_LEGEND } from "@/lib/transcript-brand";
import { parseYearSemesterKey } from "@/lib/semester-sort";

/** Official banner (uploaded registrar header) */
const TRANSCRIPT_HEADER_IMAGE = "/logo/transcript-header.png";

/** Body font: Cambria (+1px vs prior compact sizing) */
const transcriptFont = "font-['Cambria',Georgia,'Times_New_Roman',serif]";

/** Compact table cells so a full 9-semester transcript fits ~2 printed pages */
const cellBorder =
  "border border-black px-1 py-0.5 text-[11px] leading-tight print:text-[10px] print:leading-tight";
const tableHeaderCell = `${cellBorder} bg-white font-bold text-black`;

/** Column headers for course results — same neutral style as other transcript tables (no fill color) */
const courseGradeTableHeaderCell = `${cellBorder} bg-white font-bold text-black`;

const semesterHeadingLineClass = `transcript-semester-title-row border-b border-black bg-white px-2 py-1.5 text-left text-[12px] font-bold text-black underline print:border-black print:py-1 print:text-[11px]`;

/** Fixed % widths so every semester table lines up (Course Code | Title | CrHrs | Marks | Grade | GPA) */
const SEMESTER_GRADES_COL_PCTS = ["16%", "36%", "8%", "14%", "10%", "16%"] as const;

/** Student info block (top left): more breathing room per row */
const infoCell =
  "border border-black px-2 py-2 text-[11px] leading-snug print:px-2 print:py-1.5 print:text-[10px]";

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

const SEMESTER_NUMBER_WORDS = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
] as const;

/** e.g. "Semester 3" / "Semester Three" from DB label */
function formatSemesterWords(semesterLabel: string): string {
  const s = String(semesterLabel).trim();
  const m = /semester\s*(\d+)/i.exec(s);
  if (m) {
    const n = Number(m[1]);
    const w = SEMESTER_NUMBER_WORDS[n];
    if (w) return `Semester ${w}`;
    return `Semester ${m[1]}`;
  }
  return s.length > 0 ? s : "—";
}

/** "Academic Year: 2022-2023. Semester Three" */
function formatAcademicYearSemesterLine(yearStart: number, yearEnd: number, semesterLabel: string): string {
  return `Academic Year: ${yearStart}-${yearEnd}. ${formatSemesterWords(semesterLabel)}`;
}

/** Earliest calendar year appearing on the transcript (from graded semesters). */
function earliestTranscriptYear(semesterKeys: string[]): number | null {
  let min = Infinity;
  for (const k of semesterKeys) {
    const { year } = parseYearSemesterKey(k);
    if (year > 0 && year < min) min = year;
  }
  return min === Infinity ? null : min;
}

/** Calendar year from stored admission date (ISO YYYY-MM-DD uses the date, not UTC shift). */
function yearFromAdmissionDate(d: string | Date): number | null {
  const s = typeof d === "string" ? d.trim() : new Date(d).toISOString().slice(0, 10);
  const iso = /^(\d{4})-\d{2}-\d{2}/.exec(s);
  if (iso) return Number(iso[1]);
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(d).getFullYear();
}

function formatEntryYear(
  semesterKeys: string[],
  admissionDate: string | Date | undefined
): string {
  const fromGrades = earliestTranscriptYear(semesterKeys);
  if (fromGrades != null) return String(fromGrades);
  if (admissionDate) {
    const y = yearFromAdmissionDate(admissionDate);
    if (y != null) return String(y);
  }
  return "—";
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
  const entryYear =
    typeof TRANSCRIPT_BRAND.entryYearDisplay === "string" &&
    TRANSCRIPT_BRAND.entryYearDisplay.trim() !== ""
      ? TRANSCRIPT_BRAND.entryYearDisplay.trim()
      : formatEntryYear(semesterKeys, student.admissionDate);

  const legendHeading = `${TRANSCRIPT_BRAND.gradingSystemTitle.endsWith(":") ? TRANSCRIPT_BRAND.gradingSystemTitle.slice(0, -1) : TRANSCRIPT_BRAND.gradingSystemTitle}:`;

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
        className={`transcript-document ${transcriptFont} mx-auto max-w-[210mm] bg-white px-4 py-3 text-[11px] text-black print:text-[10px]`}
        style={{ color: "#000" }}
      >
        {/* Official registrar banner (logo, name, motto, contact) */}
        <div className="transcript-header-banner mb-3 print:mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={TRANSCRIPT_HEADER_IMAGE}
            alt="Abaarso Tech University — Registrar of Office"
            className="h-auto w-full max-h-[160px] object-contain object-left print:max-h-[120px]"
          />
          <div className="my-2 border-t border-black print:my-1" />
          <h2 className="text-center text-[13px] font-bold print:text-[12px]">
            {TRANSCRIPT_BRAND.documentTitle}
          </h2>
        </div>

        {/* Student info fills width up to grading table; gap-0 so tables sit flush */}
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-stretch sm:gap-0 print:mb-1 print:gap-0">
          <div className="min-w-0 w-full flex-1 sm:min-w-0">
            <table
              className="transcript-table transcript-info-table h-full w-full border border-black text-[11px] print:text-[10px]"
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
                    <td className={`${infoCell} w-[30%] font-bold`}>{label}</td>
                    <td
                      className={`${infoCell} font-bold ${label === "Student ID" ? "font-mono" : ""}`}
                    >
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <table
            className="transcript-table transcript-grading-table w-full shrink-0 border border-black text-[11px] sm:w-44 print:text-[10px]"
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
          const { year: yearEndNum, semester: semesterLabel } = parseYearSemesterKey(key);
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

          const yearEnd = yearEndNum;
          const yearStart = yearEnd - 1;
          const academicSemesterLine = formatAcademicYearSemesterLine(yearStart, yearEnd, semesterLabel);

          return (
            <div
              key={key}
              className="transcript-semester-block mb-2 last:mb-1 print:mb-1"
            >
              <div className="transcript-semester-table-wrap border border-black print:border-black">
                <div className={semesterHeadingLineClass}>{academicSemesterLine}</div>
                <table
                  className="transcript-table transcript-semester-grades-table mt-0 w-full table-fixed border-0 text-[11px] print:text-[10px]"
                  style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}
                >
                  <colgroup>
                    {SEMESTER_GRADES_COL_PCTS.map((w, i) => (
                      <col key={i} style={{ width: w }} />
                    ))}
                  </colgroup>
                <thead className="transcript-course-grade-thead">
                  <tr>
                    <th className={`${courseGradeTableHeaderCell} text-left`}>Course Code</th>
                    <th className={`${courseGradeTableHeaderCell} text-left`}>Course Title</th>
                    <th className={`${courseGradeTableHeaderCell} text-center`}>CrHrs</th>
                    <th className={`${courseGradeTableHeaderCell} text-center`}>Marks</th>
                    <th className={`${courseGradeTableHeaderCell} text-center`}>Grade</th>
                    <th className={`${courseGradeTableHeaderCell} text-center`}>GPA</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    return (
                      <tr key={r.id} className="transcript-row bg-white">
                        <td
                          className={`${cellBorder} transcript-semester-cell-code text-left font-mono font-semibold wrap-break-word`}
                        >
                          {r.course.code}
                        </td>
                        <td className={`${cellBorder} transcript-semester-cell-title text-left wrap-break-word`}>
                          {r.course.name}
                        </td>
                        <td className={`${cellBorder} text-center`}>{r.course.creditHours}</td>
                        <td className={`${cellBorder} text-center`}>
                          {r.totalMarks.toFixed(2)}
                        </td>
                        <td className={`${cellBorder} text-center font-semibold`}>
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
              </div>

              <div className="transcript-semester-gpa mt-0.5 flex flex-wrap items-baseline justify-end gap-x-4 gap-y-0 text-[11px] font-semibold print:text-[10px]">
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

        <div className="mt-2 border-t border-black pt-1.5 print:mt-1 print:pt-0.5">
          <p className="text-[11px] font-bold print:text-[10px]">
            Cumulative GPA: <span className="text-[12px] font-bold print:text-[11px]">{cumulativeGPA.toFixed(2)}</span>
          </p>
          <p className="text-[11px] print:text-[10px]">Total Credits: {totalCredits}</p>
          <p className="mt-0.5 text-[10px] text-gray-700 print:text-[9px]">
            Generated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="mt-3 flex justify-end print:mt-1">
          <div className="w-40 text-right">
            <div className="mb-0.5 h-px border-t-2 border-black" />
            <p className="text-[11px] font-bold text-gray-900 print:text-[10px]">
              {TRANSCRIPT_BRAND.officeTitle}
            </p>
            <p className="text-[10px] text-gray-600 print:text-[9px]">Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
