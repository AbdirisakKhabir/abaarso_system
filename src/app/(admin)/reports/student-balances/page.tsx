"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@/components/reports/FinanceReportChart";

type SemesterOption = { id: number; name: string };
type DepartmentOption = { id: number; name: string; code: string };
type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  department: { id: number; code: string; name: string };
};

type TermRow = {
  semester: string;
  year: number;
  charged: number;
  paid: number;
  remaining: number;
};

type BalanceStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  department: { name: string; code: string };
  className: string | null;
  currentClassTerm: string | null;
  paymentStatus: string;
  balance: number;
  terms: TermRow[];
  unknownBalance: number;
  remainingTotal: number;
};

type Line = {
  key: string;
  student: BalanceStudent;
  semesterLabel: string;
  yearLabel: string;
  charged: number | null;
  paid: number | null;
  remaining: number;
  unknown: boolean;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 14 }, (_, i) => CURRENT_YEAR + 1 - i);
const selectClassName =
  "h-10 min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white";

export default function StudentBalancesReportPage() {
  const [program, setProgram] = useState<Program>(DEFAULT_PROGRAM);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [search, setSearch] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [unknownOnly, setUnknownOnly] = useState(false);
  const [students, setStudents] = useState<BalanceStudent[]>([]);
  const [summary, setSummary] = useState<{
    studentCount: number;
    totalBalance: number;
    knownRemaining: number;
    unknownRemaining: number;
    studentsWithUnknown: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    authFetch(`/api/semesters?active=true&program=${encodeURIComponent(program)}`).then((r) => {
      if (r.ok) r.json().then((d: SemesterOption[]) => setSemesters(Array.isArray(d) ? d : []));
    });
    authFetch(`/api/departments?program=${encodeURIComponent(program)}`).then((r) => {
      if (r.ok) r.json().then((d: DepartmentOption[]) => setDepartments(Array.isArray(d) ? d : []));
    });
    authFetch(`/api/classes?program=${encodeURIComponent(program)}`).then((r) => {
      if (r.ok) r.json().then((d: ClassOption[]) => setClasses(Array.isArray(d) ? d : []));
    });
  }, [program]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (filterDept && c.department.id !== Number(filterDept)) return false;
      if (filterSemester && c.semester !== filterSemester) return false;
      if (filterYear && c.year !== Number(filterYear)) return false;
      return true;
    });
  }, [classes, filterDept, filterSemester, filterYear]);

  useEffect(() => {
    if (filterClass && !filteredClasses.some((c) => c.id === Number(filterClass))) {
      setFilterClass("");
    }
  }, [filteredClasses, filterClass]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ program });
      if (search.trim()) params.set("search", search.trim());
      if (filterSemester) params.set("semester", filterSemester);
      if (filterYear) params.set("year", filterYear);
      if (filterDept) params.set("departmentId", filterDept);
      if (filterClass) params.set("classId", filterClass);
      if (unknownOnly) params.set("unknownOnly", "true");
      const res = await authFetch(`/api/finance/student-balances?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setStudents([]);
        setSummary(null);
        setError(json.error || "Failed to load report");
        return;
      }
      setStudents(json.students || []);
      setSummary(json.summary ?? null);
    } catch {
      setStudents([]);
      setSummary(null);
      setError("Network error while loading report");
    } finally {
      setLoading(false);
    }
  }, [program, search, filterSemester, filterYear, filterDept, filterClass, unknownOnly]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const lines: Line[] = useMemo(() => {
    const out: Line[] = [];
    for (const s of students) {
      for (const t of s.terms) {
        out.push({
          key: `${s.id}-${t.semester}-${t.year}`,
          student: s,
          semesterLabel: t.semester,
          yearLabel: String(t.year),
          charged: t.charged,
          paid: t.paid,
          remaining: t.remaining,
          unknown: false,
        });
      }
      if (s.unknownBalance > 0.009) {
        out.push({
          key: `${s.id}-unknown`,
          student: s,
          semesterLabel: "Unknown semester",
          yearLabel: "—",
          charged: null,
          paid: null,
          remaining: s.unknownBalance,
          unknown: true,
        });
      }
    }
    return out;
  }, [students]);

  const {
    paginatedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    from,
    to,
  } = usePagination(lines, [students, unknownOnly]);

  const chartData = useMemo(() => {
    const byTerm = new Map<string, number>();
    let unknown = 0;
    for (const line of lines) {
      if (line.unknown) {
        unknown += line.remaining;
        continue;
      }
      const k = `${line.semesterLabel} ${line.yearLabel}`;
      byTerm.set(k, (byTerm.get(k) ?? 0) + line.remaining);
    }
    const entries = [...byTerm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (unknown > 0.009) entries.push(["Unknown semester", unknown]);
    return {
      categories: entries.map(([k]) => k),
      values: entries.map(([, v]) => v),
      known: summary?.knownRemaining ?? 0,
      unknown: summary?.unknownRemaining ?? 0,
    };
  }, [lines, summary]);

  const filterSubtitle = [
    program,
    unknownOnly ? "Unknown semester only" : null,
    filterSemester && filterYear ? `${filterSemester} ${filterYear}` : filterSemester || filterYear || "All terms",
    filterDept ? departments.find((d) => String(d.id) === filterDept)?.code : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const exportHeaders = [
    "Student ID",
    "Name",
    "Department",
    "Class",
    "Charged semester",
    "Year",
    "Charged",
    "Paid",
    "Remaining",
    "Student balance",
  ];
  const exportRows = lines.map((l) => [
    l.student.studentId,
    `${l.student.firstName} ${l.student.lastName}`,
    l.student.department.code,
    l.student.className ?? "",
    l.semesterLabel,
    l.yearLabel,
    l.charged != null ? l.charged.toFixed(2) : "",
    l.paid != null ? l.paid.toFixed(2) : "",
    l.remaining.toFixed(2),
    l.student.balance.toFixed(2),
  ]);
  const exportFooterRows: (string | number)[][] = [
    [],
    ["Students", summary?.studentCount ?? 0],
    ["Remaining on known terms", (summary?.knownRemaining ?? 0).toFixed(2)],
    ["Unknown semester", (summary?.unknownRemaining ?? 0).toFixed(2)],
    ["Student balances (ledger)", (summary?.totalBalance ?? 0).toFixed(2)],
  ];

  const handlePrint = () => window.print();

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Student Balances" />
        <div className="flex flex-wrap items-center gap-2">
          <ReportProgramFilter value={program} onChange={setProgram} className={selectClassName} />
          <Link href="/reports/payment">
            <Button variant="outline" size="sm">
              ← All Reports
            </Button>
          </Link>
          <ReportExportButtons
            title="Student Balances by Charged Semester"
            filename={`Student_Balances_${new Date().toISOString().slice(0, 10)}`}
            subtitle={filterSubtitle}
            headers={exportHeaders}
            rows={exportRows}
            footerRows={exportFooterRows}
            disabled={loading || lines.length === 0}
            onPrint={handlePrint}
          />
        </div>
      </div>

      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-bold text-gray-900">Student Balances by Charged Semester</h1>
        <p className="text-sm text-gray-600">{filterSubtitle}</p>
      </div>

      <p className="no-print mb-4 text-sm text-gray-600 dark:text-gray-400">
        Students who still owe tuition, grouped by the semester they were charged.
        Amounts charged before term tracking started (or without a class at registration) show as{" "}
        <strong>Unknown semester</strong>.
      </p>

      <div className="no-print mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/5">
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Search student
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void fetchReport()}
            placeholder="Name, student ID, or phone"
            className="h-10 w-full max-w-md rounded-lg border border-gray-200 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Charged semester</label>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className={selectClassName}
            >
              <option value="">All terms</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className={selectClassName}
            >
              <option value="">All</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Department</label>
            <select
              value={filterDept}
              onChange={(e) => {
                setFilterDept(e.target.value);
                setFilterClass("");
              }}
              className={`${selectClassName} min-w-[160px]`}
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Current class</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className={`${selectClassName} min-w-[180px]`}
            >
              <option value="">All</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.department?.code ?? "—"} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <label className="mb-1 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={unknownOnly}
              onChange={(e) => setUnknownOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            Unknown semester only
          </label>
          <Button size="sm" onClick={() => void fetchReport()}>
            Apply
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-error-500">{error}</p>}
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : !summary ? (
          <div className="py-16 text-center text-sm text-gray-500">No data.</div>
        ) : (
          <>
            <div className="grid gap-4 border-b border-gray-200 p-6 sm:grid-cols-4 dark:border-gray-800">
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-white/3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Students owing</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summary.studentCount}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-white/3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Known terms</p>
                <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                  ${summary.knownRemaining.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-white/3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Unknown semester</p>
                <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                  ${summary.unknownRemaining.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-white/3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ledger balances</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  ${summary.totalBalance.toLocaleString()}
                </p>
              </div>
            </div>

            {chartData.categories.length > 0 && (
              <div className="border-b border-gray-200 px-6 py-6 dark:border-gray-800">
                <FinanceReportChartGrid>
                  <FinanceReportDonut
                    title="Remaining: known vs unknown"
                    labels={["Known terms", "Unknown semester"]}
                    series={[chartData.known, chartData.unknown]}
                  />
                  <FinanceReportBar
                    title="Remaining by charged term"
                    categories={chartData.categories}
                    data={chartData.values}
                    color="#b45309"
                  />
                </FinanceReportChartGrid>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Student ID</TableCell>
                    <TableCell isHeader>Name</TableCell>
                    <TableCell isHeader>Department</TableCell>
                    <TableCell isHeader>Class</TableCell>
                    <TableCell isHeader>Charged semester</TableCell>
                    <TableCell isHeader className="text-right">Charged</TableCell>
                    <TableCell isHeader className="text-right">Paid</TableCell>
                    <TableCell isHeader className="text-right">Remaining</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-gray-500">
                        No students with an outstanding balance match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((l) => (
                      <TableRow key={l.key}>
                        <TableCell>
                          <Link
                            href={`/students/${encodeURIComponent(l.student.studentId)}`}
                            className="font-mono font-medium text-brand-600 hover:underline dark:text-brand-400"
                          >
                            {l.student.studentId}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {l.student.firstName} {l.student.lastName}
                        </TableCell>
                        <TableCell>
                          {l.student.department.code} — {l.student.department.name}
                        </TableCell>
                        <TableCell>{l.student.className || "—"}</TableCell>
                        <TableCell>
                          {l.unknown ? (
                            <span className="font-medium text-red-600 dark:text-red-400">
                              Unknown semester
                            </span>
                          ) : (
                            `${l.semesterLabel} ${l.yearLabel}`
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.charged != null ? `$${l.charged.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">
                          {l.paid != null ? `$${l.paid.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                          ${l.remaining.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                className="no-print"
                page={page}
                totalPages={totalPages}
                total={total}
                from={from}
                to={to}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
