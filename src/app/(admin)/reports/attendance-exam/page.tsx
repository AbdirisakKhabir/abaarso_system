"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authFetch } from "@/lib/api";

type Department = { id: number; name: string; code: string };
type ClassItem = {
  id: number;
  name: string;
  semester: string;
  year: number;
  department: { id: number; name: string; code: string };
};
type CourseItem = { id: number; code: string; name: string };
type RowData = {
  student: { id: number; studentId: string; firstName: string; lastName: string };
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    totalSessions: number;
    attendancePercent: number;
    attendanceMarks: number;
  };
  examRecords: {
    courseId: number;
    courseCode: string;
    courseName: string;
    midExam: number;
    finalExam: number;
    assessment: number;
    project: number;
    assignment: number;
    presentation: number;
    totalMarks: number;
    grade: string;
    gradePoints: number;
  }[];
};

export default function AttendanceExamReportPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [classInfo, setClassInfo] = useState<{
    name: string;
    semester: string;
    year: number;
    totalSessions: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterDept, setFilterDept] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterCourse, setFilterCourse] = useState("");

  const fetchReport = useCallback(async () => {
    if (!filterClass) {
      setRows([]);
      setClassInfo(null);
      setCourses([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ classId: filterClass });
      if (filterCourse) params.set("courseId", filterCourse);
      const res = await authFetch(`/api/reports/attendance-exam?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
        setCourses(data.courses || []);
        setClassInfo(
          data.class
            ? {
                name: data.class.name,
                semester: data.semester || data.class.semester,
                year: data.year ?? data.class.year,
                totalSessions: data.totalSessions ?? 0,
              }
            : null
        );
      } else {
        setRows([]);
        setClassInfo(null);
      }
    } catch {
      setRows([]);
      setClassInfo(null);
    }
    setLoading(false);
  }, [filterClass, filterCourse]);

  useEffect(() => {
    authFetch("/api/departments").then((r) => {
      if (r.ok) r.json().then((d: Department[]) => setDepartments(d));
    });
    authFetch("/api/classes").then((r) => {
      if (r.ok) r.json().then((d: ClassItem[]) => setClasses(d));
    });
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const filteredClasses = filterDept
    ? classes.filter((c) => c.department?.id === Number(filterDept))
    : classes;

  const handlePrint = () => window.print();

  const displayCourses = filterCourse
    ? courses.filter((c) => String(c.id) === filterCourse)
    : courses;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Attendance & Exam Report" />
        <Button size="sm" onClick={handlePrint}>
          Print
        </Button>
      </div>

      <div className="mb-4 print:block hidden print:mb-2">
        <h1 className="text-xl font-bold text-gray-900">
          Attendance & Exam Report
        </h1>
        <p className="text-sm text-gray-600">
          Generated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <div className="no-print border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            Filters
          </h3>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Department
              </label>
              <select
                value={filterDept}
                onChange={(e) => {
                  setFilterDept(e.target.value);
                  setFilterClass("");
                }}
                className="h-10 min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Class
              </label>
              <select
                value={filterClass}
                onChange={(e) => {
                  setFilterClass(e.target.value);
                  setFilterCourse("");
                }}
                className="h-10 min-w-[200px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">Select Class</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.department?.code} - {c.name} ({c.semester} {c.year})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Course (optional)
              </label>
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="h-10 min-w-[200px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Attendance (Present + Excused) counts as 10% of the exam grade. Data
            is filtered by the class&apos;s semester and year.
          </p>
        </div>

        {classInfo && (
          <div className="flex flex-wrap gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div className="rounded-xl bg-brand-50 px-4 py-2 dark:bg-brand-500/10">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Class
              </span>
              <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
                {classInfo.name} ({classInfo.semester} {classInfo.year})
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-2 dark:bg-white/5">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Total Sessions
              </span>
              <p className="text-xl font-bold text-gray-800 dark:text-white/90">
                {classInfo.totalSessions}
              </p>
            </div>
            <div className="rounded-xl bg-green-50 px-4 py-2 dark:bg-green-500/10">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Attendance = 10% of Exam
              </span>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                (Present + Excused) / Total × 10
              </p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {!filterClass ? (
            <div className="px-5 py-12 text-center text-sm text-gray-500">
              Select a class to view attendance and exam results.
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <span className="text-sm text-gray-500">Loading...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-500">
              No students in this class or no data for the selected filters.
            </div>
          ) : (
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                  >
                    Student
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                  >
                    Present
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                  >
                    Absent
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                  >
                    Excused
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                  >
                    Attend %
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                  >
                    Marks (0-10)
                  </TableCell>
                  {displayCourses.map((c) => (
                    <TableCell
                      key={c.id}
                      isHeader
                      className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                    >
                      {c.code} Total
                    </TableCell>
                  ))}
                  {displayCourses.map((c) => (
                    <TableCell
                      key={`g-${c.id}`}
                      isHeader
                      className="px-5 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                    >
                      {c.code} Grade
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const examMap = new Map(
                    r.examRecords.map((e) => [e.courseId, e])
                  );
                  return (
                    <TableRow
                      key={r.student.id}
                      className="border-b border-gray-50 dark:border-gray-800"
                    >
                      <TableCell className="px-5 py-3">
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {r.student.firstName} {r.student.lastName}
                        </p>
                        <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {r.student.studentId}
                        </p>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-center font-medium text-green-600 dark:text-green-400">
                        {r.attendance.present}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-center font-medium text-red-600 dark:text-red-400">
                        {r.attendance.absent}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                        {r.attendance.excused}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-center">
                        <span
                          className={
                            r.attendance.attendancePercent >= 80
                              ? "font-medium text-green-600 dark:text-green-400"
                              : r.attendance.attendancePercent >= 60
                                ? "text-yellow-600 dark:text-yellow-500"
                                : "font-medium text-red-600 dark:text-red-400"
                          }
                        >
                          {r.attendance.attendancePercent}%
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-center font-medium text-gray-800 dark:text-white/90">
                        {r.attendance.attendanceMarks.toFixed(2)}
                      </TableCell>
                      {displayCourses.map((c) => {
                        const exam = examMap.get(c.id);
                        return (
                          <TableCell
                            key={c.id}
                            className="px-5 py-3 text-center text-sm text-gray-700 dark:text-gray-300"
                          >
                            {exam ? exam.totalMarks.toFixed(1) : "—"}
                          </TableCell>
                        );
                      })}
                      {displayCourses.map((c) => {
                        const exam = examMap.get(c.id);
                        return (
                          <TableCell
                            key={`g-${c.id}`}
                            className="px-5 py-3 text-center"
                          >
                            {exam ? (
                              <span
                                className={
                                  exam.grade === "A" || exam.grade === "A-"
                                    ? "font-medium text-green-600 dark:text-green-400"
                                    : exam.grade === "F"
                                      ? "font-medium text-red-600 dark:text-red-400"
                                      : "text-gray-700 dark:text-gray-300"
                                }
                              >
                                {exam.grade || "—"}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
