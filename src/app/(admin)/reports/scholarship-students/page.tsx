"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/usePagination";
import { authFetch } from "@/lib/api";
import { ReportExportButtons } from "@/components/reports/ReportExportButtons";
import { ReportProgramFilter } from "@/components/reports/ReportProgramFilter";
import { DEFAULT_PROGRAM, type Program } from "@/lib/program";
import {
  FinanceReportBar,
  FinanceReportDonut,
  FinanceReportChartGrid,
  formatCount,
} from "@/components/reports/FinanceReportChart";

type SemesterOption = { id: number; name: string; sortOrder: number; isActive: boolean };
type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  department: { id: number; code: string; name: string };
};
type DepartmentOption = { id: number; name: string; code: string };
type ScholarshipStudentRow = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  department: { name: string; code: string; tuitionFee: number | null };
  paymentStatus: string;
  amountExpected?: number;
  amountPaid?: number;
  amountDue?: number;
  tuitionStatus: string;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 14 }, (_, i) => CURRENT_YEAR + 1 - i);
const SCHOLARSHIP_TYPE_OPTIONS = [
  { value: "all", label: "All scholarship students" },
  { value: "Full Scholarship", label: "Full Scholarship" },
  { value: "Half Scholar", label: "Half Scholar" },
] as const;

export default function ScholarshipStudentsReportPage() {
  const [program, setProgram] = useState<Program>(DEFAULT_PROGRAM);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [scholarshipSemester, setScholarshipSemester] = useState("");
  const [scholarshipYear, setScholarshipYear] = useState(String(CURRENT_YEAR));
  const [filterDeptId, setFilterDeptId] = useState<string>("all");
  const [scholarshipClassId, setScholarshipClassId] = useState("");
  const [scholarshipType, setScholarshipType] = useState<string>("all");
  const [scholarshipStudents, setScholarshipStudents] = useState<ScholarshipStudentRow[]>([]);
  const [classInfo, setClassInfo] = useState<{
    name: string;
    semester: string;
    year: number;
    department: { code: string; name: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authFetch(`/api/semesters?active=true&program=${encodeURIComponent(program)}`).then((r) => {
      if (r.ok) r.json().then((d: SemesterOption[]) => {
        setSemesters(Array.isArray(d) ? d : []);
      });
    });
    authFetch(`/api/classes?program=${encodeURIComponent(program)}`).then((r) => {
      if (r.ok) r.json().then((d: ClassOption[]) => setClasses(Array.isArray(d) ? d : []));
    });
    authFetch(`/api/departments?program=${encodeURIComponent(program)}`).then((r) => {
      if (r.ok) r.json().then((d: DepartmentOption[]) => setDepartments(Array.isArray(d) ? d : []));
    });
  }, [program]);

  useEffect(() => {
    if (semesters.length > 0) {
      setScholarshipSemester((prev) =>
        prev && semesters.some((s) => s.name === prev) ? prev : semesters[0].name
      );
    } else {
      setScholarshipSemester("");
    }
  }, [semesters]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (c.semester !== scholarshipSemester || c.year !== Number(scholarshipYear)) return false;
      if (filterDeptId !== "all" && c.department.id !== Number(filterDeptId)) return false;
      return true;
    });
  }, [classes, scholarshipSemester, scholarshipYear, filterDeptId]);

  useEffect(() => {
    if (scholarshipClassId && !filteredClasses.some((c) => c.id === Number(scholarshipClassId))) {
      setScholarshipClassId("");
    }
  }, [filteredClasses, scholarshipClassId]);

  const handleGenerate = async () => {
    if (!scholarshipSemester || !scholarshipYear || !scholarshipClassId) return;
    setLoading(true);
    setClassInfo(null);
    setScholarshipStudents([]);
    try {
      const params = new URLSearchParams({
        semester: scholarshipSemester,
        year: scholarshipYear,
        classId: scholarshipClassId,
        scholarshipType,
        program,
      });
      const res = await authFetch(`/api/finance/scholarship-students?${params}`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to load scholarship students");
        return;
      }
      setClassInfo(data.class);
      setScholarshipStudents(data.scholarshipStudents || []);
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const {
    paginatedItems: paginatedStudents,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: studentsTotal,
    from,
    to,
  } = usePagination(scholarshipStudents, [
    scholarshipSemester,
    scholarshipYear,
    scholarshipClassId,
    filterDeptId,
    scholarshipType,
    scholarshipStudents,
  ]);

  const byScholarshipType = useMemo(() => {
    if (!scholarshipStudents.length) return { categories: [] as string[], values: [] as number[] };
    const m = new Map<string, number>();
    for (const s of scholarshipStudents) {
      m.set(s.paymentStatus, (m.get(s.paymentStatus) ?? 0) + 1);
    }
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { categories: entries.map(([k]) => k), values: entries.map(([, v]) => v) };
  }, [scholarshipStudents]);

  const byTuitionStatus = useMemo(() => {
    if (!scholarshipStudents.length) return { labels: [] as string[], series: [] as number[] };
    const m = new Map<string, number>();
    for (const s of scholarshipStudents) {
      m.set(s.tuitionStatus, (m.get(s.tuitionStatus) ?? 0) + 1);
    }
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(([k]) => k), series: entries.map(([, v]) => v) };
  }, [scholarshipStudents]);

  const totalDue = scholarshipStudents.reduce((s, t) => s + (t.amountDue ?? 0), 0);
  const totalPaid = scholarshipStudents.reduce((s, t) => s + (t.amountPaid ?? 0), 0);

  const exportHeaders = [
    "Student ID",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Department",
    "Scholarship Type",
    "Status",
    "Expected",
    "Paid",
    "Due",
  ];
  const exportRows = scholarshipStudents.map((s) => [
    s.studentId,
    s.firstName,
    s.lastName,
    s.email || "",
    s.phone || "",
    `${s.department.code} - ${s.department.name}`,
    s.paymentStatus,
    s.tuitionStatus,
    s.amountExpected != null ? String(s.amountExpected) : "",
    s.amountPaid != null ? String(s.amountPaid) : "",
    s.amountDue != null ? String(s.amountDue) : "",
  ]);
  const exportFooterRows = [
    ["", "", "", "", "", "", "TOTAL", "", "", totalPaid.toFixed(2), totalDue.toFixed(2)],
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Scholarship Students Report" />
        {classInfo && (
          <ReportExportButtons
            title="Scholarship Students Report"
            filename={`Scholarship_Students_${classInfo.department?.code || "class"}_${scholarshipSemester}_${scholarshipYear}`}
            subtitle={`${classInfo.department.code} - ${classInfo.name} (${classInfo.semester} ${classInfo.year})`}
            headers={exportHeaders}
            rows={exportRows}
            footerRows={exportFooterRows}
            disabled={!scholarshipStudents.length}
            onPrint={handlePrint}
          />
        )}
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Scholarship Students by Semester &amp; Class
        </h3>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          List students on full or half scholarship for a semester and class. Paid and unpaid tuition
          reports exclude scholarship students.
        </p>
        <div className="no-print mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Program
            </label>
            <ReportProgramFilter
              value={program}
              onChange={(p) => {
                setProgram(p);
                setFilterDeptId("all");
                setScholarshipClassId("");
                setScholarshipSemester("");
              }}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Semester
            </label>
            <select
              value={scholarshipSemester}
              onChange={(e) => setScholarshipSemester(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[120px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              {semesters.length === 0 ? (
                <option value="">No semesters configured</option>
              ) : (
                semesters.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
            <select
              value={scholarshipYear}
              onChange={(e) => setScholarshipYear(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[100px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Department
            </label>
            <select
              value={filterDeptId}
              onChange={(e) => {
                setFilterDeptId(e.target.value);
                setScholarshipClassId("");
              }}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Scholarship type
            </label>
            <select
              value={scholarshipType}
              onChange={(e) => setScholarshipType(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[200px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              {SCHOLARSHIP_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Class</label>
            <select
              value={scholarshipClassId}
              onChange={(e) => setScholarshipClassId(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[220px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              <option value="">Select class</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.department.code} - {c.name} ({c.semester} {c.year})
                </option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={!scholarshipClassId || loading || semesters.length === 0}
          >
            {loading ? "Loading..." : "Generate List"}
          </Button>
        </div>

        {classInfo && (
          <>
            <div className="mb-4 hidden print:mb-2 print:block">
              <h1 className="text-xl font-bold text-gray-900">Scholarship Students Report</h1>
              <p className="text-sm text-gray-600">
                {classInfo.department.code} - {classInfo.name} ({classInfo.semester} {classInfo.year})
              </p>
              <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
            </div>

            {scholarshipStudents.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center dark:border-gray-700 dark:bg-white/5">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  No scholarship students found in this class for {classInfo.semester} {classInfo.year}
                  {scholarshipType !== "all" ? ` (${scholarshipType})` : ""}.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  {scholarshipStudents.length} students · Collected{" "}
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                    ${totalPaid.toLocaleString()}
                  </span>
                  {totalDue > 0 && (
                    <>
                      {" "}
                      · Still due{" "}
                      <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                        ${totalDue.toLocaleString()}
                      </span>
                    </>
                  )}
                </p>
                {byScholarshipType.categories.length > 0 && (
                  <FinanceReportChartGrid>
                    {byTuitionStatus.labels.length > 0 && (
                      <FinanceReportDonut
                        title="Students by tuition status"
                        labels={byTuitionStatus.labels}
                        series={byTuitionStatus.series}
                        valueFormatter={formatCount}
                      />
                    )}
                    <FinanceReportBar
                      title="Students by scholarship type"
                      categories={byScholarshipType.categories}
                      data={byScholarshipType.values}
                      color="#7c3aed"
                      valueFormatter={formatCount}
                    />
                  </FinanceReportChartGrid>
                )}
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-transparent! hover:bg-transparent!">
                        <TableCell isHeader>Student ID</TableCell>
                        <TableCell isHeader>Name</TableCell>
                        <TableCell isHeader>Email</TableCell>
                        <TableCell isHeader>Phone</TableCell>
                        <TableCell isHeader>Department</TableCell>
                        <TableCell isHeader>Scholarship</TableCell>
                        <TableCell isHeader>Status</TableCell>
                        <TableCell isHeader className="text-right">Expected</TableCell>
                        <TableCell isHeader className="text-right">Paid</TableCell>
                        <TableCell isHeader className="text-right">Due</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedStudents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <span className="no-print">
                              <Link
                                href={`/students/${encodeURIComponent(s.studentId)}`}
                                className="font-mono font-medium text-brand-600 hover:underline dark:text-brand-400"
                              >
                                {s.studentId}
                              </Link>
                            </span>
                            <span className="hidden font-mono font-medium text-gray-800 print:inline">
                              {s.studentId}
                            </span>
                          </TableCell>
                          <TableCell>
                            {s.firstName} {s.lastName}
                          </TableCell>
                          <TableCell>{s.email || "—"}</TableCell>
                          <TableCell>{s.phone || "—"}</TableCell>
                          <TableCell>
                            {s.department.code} - {s.department.name}
                          </TableCell>
                          <TableCell>{s.paymentStatus}</TableCell>
                          <TableCell>{s.tuitionStatus}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.amountExpected != null ? `$${Number(s.amountExpected).toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">
                            {s.amountPaid != null ? `$${Number(s.amountPaid).toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                            {s.amountDue != null && s.amountDue > 0
                              ? `$${Number(s.amountDue).toLocaleString()}`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                        <TableCell colSpan={8} className="text-right">
                          Totals
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                          ${totalPaid.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">
                          ${totalDue.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <TablePagination
                    className="no-print"
                    page={page}
                    totalPages={totalPages}
                    total={studentsTotal}
                    from={from}
                    to={to}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
