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
import { DownloadIcon } from "@/icons";
import { ReportProgramFilter } from "@/components/reports/ReportProgramFilter";
import { DEFAULT_PROGRAM, type Program } from "@/lib/program";
import {
  FinanceReportBar,
  FinanceReportDonut,
  FinanceReportChartGrid,
  formatCount,
} from "@/components/reports/FinanceReportChart";

type SemesterOption = { id: number; name: string; sortOrder: number; isActive: boolean };
type ClassOption = { id: number; name: string; semester: string; year: number; department: { id: number; code: string; name: string } };
type UnpaidStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  department: { name: string; code: string; tuitionFee: number | null };
  className?: string | null;
  tuitionFee: number | null;
  paymentStatus?: string;
  amountPaid?: number;
  amountDue?: number;
};
type DepartmentOption = { id: number; name: string; code: string };
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 14 }, (_, i) => CURRENT_YEAR + 1 - i);

export default function UnpaidStudentsReportPage() {
  const [program, setProgram] = useState<Program>(DEFAULT_PROGRAM);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [unpaidSemester, setUnpaidSemester] = useState("");
  const [unpaidYear, setUnpaidYear] = useState(String(CURRENT_YEAR));
  const [filterDeptId, setFilterDeptId] = useState<string>("all");
  const [unpaidClassId, setUnpaidClassId] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [unpaidStudents, setUnpaidStudents] = useState<UnpaidStudent[]>([]);
  const [reportScope, setReportScope] = useState<"class" | "department">("class");
  const [unpaidClassInfo, setUnpaidClassInfo] = useState<{ name: string; semester: string; year: number; department: { code: string; name: string } } | null>(null);
  const [unpaidDeptInfo, setUnpaidDeptInfo] = useState<{ code: string; name: string } | null>(null);
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
      setUnpaidSemester((prev) =>
        prev && semesters.some((s) => s.name === prev) ? prev : semesters[0].name
      );
    } else {
      setUnpaidSemester("");
    }
  }, [semesters]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (c.semester !== unpaidSemester || c.year !== Number(unpaidYear)) return false;
      if (filterDeptId !== "all" && c.department.id !== Number(filterDeptId)) return false;
      return true;
    });
  }, [classes, unpaidSemester, unpaidYear, filterDeptId]);

  const canGenerate =
    unpaidSemester &&
    unpaidYear &&
    (unpaidClassId === "all" ? filterDeptId !== "all" : Boolean(unpaidClassId));

  useEffect(() => {
    if (unpaidClassId && unpaidClassId !== "all" && !filteredClasses.some((c) => c.id === Number(unpaidClassId))) {
      setUnpaidClassId("");
    }
  }, [filteredClasses, unpaidClassId]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setUnpaidClassInfo(null);
    setUnpaidDeptInfo(null);
    setUnpaidStudents([]);
    try {
      const params = new URLSearchParams({
        semester: unpaidSemester,
        year: unpaidYear,
        classId: unpaidClassId,
        program,
      });
      if (filterDeptId !== "all") params.set("departmentId", filterDeptId);
      params.set("paymentStatusFilter", paymentStatusFilter);
      const res = await authFetch(`/api/finance/unpaid-students?${params}`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to load unpaid students");
        return;
      }
      setReportScope(data.scope === "department" ? "department" : "class");
      if (data.scope === "department") {
        setUnpaidDeptInfo(data.department);
        setUnpaidClassInfo(null);
      } else {
        setUnpaidClassInfo(data.class);
        setUnpaidDeptInfo(null);
      }
      setUnpaidStudents(data.unpaidStudents || []);
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const {
    paginatedItems: paginatedUnpaidStudents,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: unpaidStudentsTotal,
    from,
    to,
  } = usePagination(unpaidStudents, [unpaidSemester, unpaidYear, unpaidClassId, filterDeptId, unpaidStudents]);

  const showClassColumn = reportScope === "department";

  const unpaidByDept = useMemo(() => {
    if (!unpaidStudents.length) return { categories: [] as string[], values: [] as number[] };
    const m = new Map<string, number>();
    for (const s of unpaidStudents) {
      const k = `${s.department.code} · ${s.department.name}`;
      m.set(k, (m.get(k) ?? 0) + (s.tuitionFee ?? 0));
    }
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { categories: entries.map(([k]) => k), values: entries.map(([, v]) => v) };
  }, [unpaidStudents]);

  const unpaidByStatus = useMemo(() => {
    if (!unpaidStudents.length) return { labels: [] as string[], series: [] as number[] };
    const m = new Map<string, number>();
    for (const s of unpaidStudents) {
      const k = s.paymentStatus || "Fully Paid";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(([k]) => k), series: entries.map(([, v]) => v) };
  }, [unpaidStudents]);

  const handleExportCSV = () => {
    if (unpaidStudents.length === 0) return;
    const headers = ["Student ID", "First Name", "Last Name", "Email", "Phone", "Department", "Payment Status", "Amount Due"];
    const rows = unpaidStudents.map((s) => [
      s.studentId,
      s.firstName,
      s.lastName,
      s.email || "",
      s.phone || "",
      `${s.department.code} - ${s.department.name}`,
      s.paymentStatus || "Fully Paid",
      s.tuitionFee != null ? String(s.tuitionFee) : "",
    ]);
    const totalDue = unpaidStudents.reduce((s, t) => s + (t.tuitionFee ?? 0), 0);
    const totalRow = ["", "TOTAL", "", "", "", "", "", totalDue.toFixed(2)];
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")), totalRow.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Unpaid_Students_${unpaidClassInfo?.department?.code || "class"}_${unpaidSemester}_${unpaidYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Unpaid Students Report" />
        {(unpaidClassInfo || unpaidDeptInfo) && unpaidStudents.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
              Export CSV
            </Button>
            <Button size="sm" onClick={handlePrint}>
              Print
            </Button>
          </div>
        )}
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Unpaid Students by Semester & Class
        </h3>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Select semester, year, department, and class. Filter by fully paid or half scholarship
          students. Scholarship students are on a separate report.
        </p>
        <div className="no-print mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Program</label>
            <ReportProgramFilter
              value={program}
              onChange={(p) => {
                setProgram(p);
                setFilterDeptId("all");
                setUnpaidClassId("");
                setUnpaidSemester("");
              }}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
            <select
              value={unpaidSemester}
              onChange={(e) => setUnpaidSemester(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[120px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              {semesters.length === 0 ? (
                <option value="">No semesters configured</option>
              ) : (
                semesters.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
            <select
              value={unpaidYear}
              onChange={(e) => setUnpaidYear(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[100px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
            <select
              value={filterDeptId}
              onChange={(e) => {
                setFilterDeptId(e.target.value);
                setUnpaidClassId("");
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
              Student type
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              <option value="all">Fully paid + half scholarship</option>
              <option value="Fully Paid">Fully paid students</option>
              <option value="Half Scholar">Half scholarship students</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Class</label>
            <select
              value={unpaidClassId}
              onChange={(e) => setUnpaidClassId(e.target.value)}
              className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[200px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              <option value="">Select class</option>
              {filterDeptId !== "all" && (
                <option value="all">All classes in department</option>
              )}
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.department.code} - {c.name} ({c.semester} {c.year})
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={handleGenerate} disabled={!canGenerate || loading || semesters.length === 0}>
            {loading ? "Loading..." : "Generate List"}
          </Button>
        </div>

        {(unpaidClassInfo || unpaidDeptInfo) && (
          <>
            <div className="mb-4 print:block hidden print:mb-2">
              <h1 className="text-xl font-bold text-gray-900">Unpaid Students Report</h1>
              <p className="text-sm text-gray-600">
                {unpaidClassInfo
                  ? `${unpaidClassInfo.department.code} - ${unpaidClassInfo.name} (${unpaidClassInfo.semester} ${unpaidClassInfo.year})`
                  : `${unpaidDeptInfo?.code} - ${unpaidDeptInfo?.name} · All classes (${unpaidSemester} ${unpaidYear})`}
              </p>
              <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
            </div>

            {unpaidStudents.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center dark:border-gray-700 dark:bg-white/5">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {unpaidClassInfo
                    ? `All students in this class have paid for ${unpaidClassInfo.semester} ${unpaidClassInfo.year}.`
                    : `All students in this department have paid for ${unpaidSemester} ${unpaidYear}.`}
                </p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  {unpaidStudents.length} students · Total due{" "}
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                    $
                    {unpaidStudents
                      .reduce((s, t) => s + (t.tuitionFee ?? 0), 0)
                      .toLocaleString()}
                  </span>
                </p>
                {unpaidByDept.categories.length > 0 && (
                  <FinanceReportChartGrid>
                    {unpaidByStatus.labels.length > 0 && (
                      <FinanceReportDonut
                        title="Unpaid students by payment type"
                        labels={unpaidByStatus.labels}
                        series={unpaidByStatus.series}
                        valueFormatter={formatCount}
                      />
                    )}
                    <FinanceReportBar
                      title="Amount due by department"
                      categories={unpaidByDept.categories}
                      data={unpaidByDept.values}
                      color="#b45309"
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
                        {showClassColumn && <TableCell isHeader>Class</TableCell>}
                        <TableCell isHeader>Department</TableCell>
                        <TableCell isHeader>Payment</TableCell>
                        <TableCell isHeader className="text-right">Amount Due</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUnpaidStudents.map((s) => (
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
                            <span className="hidden print:inline font-mono font-medium text-gray-800">{s.studentId}</span>
                          </TableCell>
                          <TableCell>{s.firstName} {s.lastName}</TableCell>
                          <TableCell>{s.email || "—"}</TableCell>
                          <TableCell>{s.phone || "—"}</TableCell>
                          {showClassColumn && <TableCell>{s.className || "—"}</TableCell>}
                          <TableCell>{s.department.code} - {s.department.name}</TableCell>
                          <TableCell>{s.paymentStatus || "Fully Paid"}</TableCell>
                          <TableCell className="text-right">
                            {s.tuitionFee != null ? `$${Number(s.tuitionFee).toLocaleString()}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                        <TableCell colSpan={showClassColumn ? 7 : 6} className="text-right">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">
                          ${unpaidStudents
                            .reduce((s, t) => s + (t.tuitionFee ?? 0), 0)
                            .toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <TablePagination
                    className="no-print"
                    page={page}
                    totalPages={totalPages}
                    total={unpaidStudentsTotal}
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
