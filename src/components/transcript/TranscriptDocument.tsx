"use client";

import React from "react";
import Button from "@/components/ui/button/Button";
import { TRANSCRIPT_BRAND, GRADING_SYSTEM_LEGEND } from "@/lib/transcript-brand";

const cellBorder = "border border-black px-1.5 py-0.5";
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
    backgroundColor: TRANSCRIPT_BRAND.semesterBandBg,
    color: TRANSCRIPT_BRAND.semesterBandText,
  };

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
        className="transcript-document mx-auto max-w-[210mm] bg-white px-6 py-4 font-[Arial,Helvetica,sans-serif] text-black text-[13px] print:px-6 print:py-4 print:text-[13px]"
        style={{ color: "#000" }}
      >
        {/* Header: logo top-left, title block centered */}
        <div className="relative mb-6 min-h-20">
          <div className="absolute left-0 top-0 h-20 w-20 shrink-0 overflow-hidden print:h-16 print:w-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={TRANSCRIPT_BRAND.logoUrl}
              alt="University logo"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div className="px-20 text-center print:px-16">
            <h1 className="text-2xl font-bold uppercase tracking-tight print:text-xl">
              {TRANSCRIPT_BRAND.universityName}
            </h1>
            <p className="mt-1 text-[15px] italic print:text-sm">
              E-mail Address: {TRANSCRIPT_BRAND.email}, Website: {TRANSCRIPT_BRAND.website}
            </p>
            <p className="mt-2 text-[15px] font-bold print:text-sm">{TRANSCRIPT_BRAND.officeTitle}</p>
            <div className="my-3 border-t border-black print:my-2" />
            <h2 className="text-lg font-bold print:text-base">{TRANSCRIPT_BRAND.documentTitle}</h2>
          </div>
        </div>

        {/* Student info + Grading system */}
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <table
            className="transcript-table flex-1 border border-black text-[13px] print:text-[13px]"
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
            className="transcript-table w-full shrink-0 border border-black text-[12px] sm:w-52 print:text-[12px]"
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
              className={`transcript-semester-block mb-8 last:mb-4 ${keyIdx > 0 ? "break-before-page" : ""}`}
            >
              <div
                className="transcript-semester-band px-4 py-2.5 text-base font-bold leading-snug print:text-sm print:py-2"
                style={semesterBandStyle}
              >
                <div>Academic Year: {yearStart}-{yearEnd}</div>
                <div>{formatSemesterLabel(semester)}</div>
              </div>

              <table
                className="transcript-table mt-0 w-full border border-black text-[13px] print:text-[13px]"
                style={{ borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <th rowSpan={2} className={`${tableHeaderCell} text-left`}>
                      Course Code
                    </th>
                    <th rowSpan={2} className={`${tableHeaderCell} text-left`}>
                      Course Title
                    </th>
                    <th rowSpan={2} className={`${tableHeaderCell} w-10 text-center`}>
                      CrHrs
                    </th>
                    <th colSpan={3} className={`${tableHeaderCell} text-center`}>
                      Grades
                    </th>
                  </tr>
                  <tr>
                    {(["Marks", "Grade", "GPA"] as const).map((h) => (
                      <th key={h} className={`${tableHeaderCell} w-12 text-center`}>
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
                        <td className={`${cellBorder} font-mono`}>{r.course.code}</td>
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

              <div className="transcript-semester-gpa mt-2 flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 text-[13px] font-semibold print:text-[13px]">
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

        <div className="mt-4 border-t border-black pt-3 print:mt-3">
          <p className="text-[13px] font-bold print:text-[13px]">
            Cumulative GPA: <span className="text-base">{cumulativeGPA.toFixed(2)}</span>
          </p>
          <p className="text-[12px] print:text-[12px]">Total Credits: {totalCredits}</p>
          <p className="mt-1 text-[12px] text-gray-700 print:text-[12px]">
            Generated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="mt-8 flex justify-end print:mt-8">
          <div className="w-48 text-right">
            <div className="mb-1 h-px border-t-2 border-black" />
            <p className="text-[12px] font-bold text-gray-900 print:text-[12px]">
              {TRANSCRIPT_BRAND.officeTitle}
            </p>
            <p className="text-[11px] text-gray-600 print:text-[11px]">Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
