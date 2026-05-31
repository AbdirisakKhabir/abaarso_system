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
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { DateInput } from "@/components/form/DateInput";
import { DownloadIcon } from "@/icons";
import { FinanceReportBarHorizontal } from "@/components/reports/FinanceReportChart";

type Department = { id: number; name: string; code: string };
type ClassItem = {
  id: number;
  name: string;
  semester: string;
  year: number;
  department: { id: number; name: string; code: string };
};
type SemesterOpt = { id: number; name: string };

const CURRENT_YEAR = new Date().getFullYear();
const TX_YEAR_OPTIONS = Array.from({ length: 14 }, (_, i) => CURRENT_YEAR + 1 - i);

export default function StudentTransactionsReportPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [semestersTx, setSemestersTx] = useState<SemesterOpt[]>([]);
  const [transactions, setTransactions] = useState<
    {
      studentId: string;
      firstName: string;
      lastName: string;
      department: { name: string; code: string };
      class: { department: { code: string }; name: string } | null;
      paidCount: number;
      unpaidCount: number;
      paidSemesters: string[];
      unpaidSemesters: string[];
      totalPaid: number;
      tuitionFee: number | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [filterYear, setFilterYear] = useState(String(CURRENT_YEAR));
  const [filterDept, setFilterDept] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterClassSemester, setFilterClassSemester] = useState<string>("all");
  const [filterClassYear, setFilterClassYear] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPaymentSemester, setFilterPaymentSemester] = useState("");
  const [filterPaidOnly, setFilterPaidOnly] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: filterYear });
      if (filterDept) params.set("departmentId", filterDept);
      if (filterClass) params.set("classId", filterClass);
      else if (filterClassSemester !== "all" && filterClassYear !== "all") {
        params.set("classSemester", filterClassSemester);
        params.set("classYear", filterClassYear);
      }
      if (filterSearch.trim()) params.set("search", filterSearch.trim());
      if (filterPhone) params.set("phone", filterPhone);
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);
      if (filterPaymentSemester) params.set("paymentSemester", filterPaymentSemester);
      if (!filterPaidOnly) params.set("paidOnly", "false");
      const res = await authFetch(`/api/finance/students-transactions?${params}`);
      if (res.ok) setTransactions(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, [
    filterYear,
    filterDept,
    filterClass,
    filterClassSemester,
    filterClassYear,
    filterSearch,
    filterPhone,
    filterDateFrom,
    filterDateTo,
    filterPaymentSemester,
    filterPaidOnly,
  ]);

  useEffect(() => {
    authFetch("/api/departments").then((r) => {
      if (r.ok) r.json().then((d: Department[]) => setDepartments(d));
    });
    authFetch("/api/classes").then((r) => {
      if (r.ok) r.json().then((d: ClassItem[]) => setClasses(Array.isArray(d) ? d : []));
    });
    authFetch("/api/semesters?active=true").then((r) => {
      if (r.ok) r.json().then((d: SemesterOpt[]) => {
        setSemestersTx(Array.isArray(d) ? d.map((s) => ({ id: s.id, name: s.name })) : []);
      });
    });
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredClasses = useMemo(() => {
    let list = filterDept
      ? classes.filter((c) => c.department?.id === Number(filterDept))
      : classes;
    if (filterClassSemester !== "all") {
      list = list.filter((c) => c.semester === filterClassSemester);
    }
    if (filterClassYear !== "all") {
      list = list.filter((c) => c.year === Number(filterClassYear));
    }
    return list;
  }, [classes, filterDept, filterClassSemester, filterClassYear]);

  useEffect(() => {
    if (filterClass && !filteredClasses.some((c) => String(c.id) === filterClass)) {
      setFilterClass("");
    }
  }, [filteredClasses, filterClass]);

  const classYearOptions = useMemo(() => {
    const ys = new Set<number>();
    for (const c of classes) {
      if (typeof c.year === "number") ys.add(c.year);
    }
    for (const y of TX_YEAR_OPTIONS) ys.add(y);
    return [...ys].sort((a, b) => b - a);
  }, [classes]);

  const {
    paginatedItems: paginatedTransactions,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: transactionsTotal,
    from,
    to,
  } = usePagination(transactions, [
    filterYear,
    filterDept,
    filterClass,
    filterClassSemester,
    filterClassYear,
    filterSearch,
    filterPhone,
    filterDateFrom,
    filterDateTo,
    filterPaymentSemester,
    filterPaidOnly,
  ]);

  const paidByDept = useMemo(() => {
    if (!transactions.length) return { categories: [] as string[], values: [] as number[] };
    const m = new Map<string, number>();
    for (const t of transactions) {
      const k = `${t.department?.code ?? "—"} · ${t.department?.name ?? ""}`.trim();
      m.set(k, (m.get(k) ?? 0) + t.totalPaid);
    }
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    return { categories: entries.map(([k]) => k), values: entries.map(([, v]) => v) };
  }, [transactions]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const headers = ["Student ID", "Name", "Department", "Class", "Paid", "Unpaid", "Total Paid"];
    const rows = transactions.map((t) => [
      t.studentId,
      `${t.firstName} ${t.lastName}`,
      `${t.department?.code} - ${t.department?.name}`,
      t.class ? `${t.class.department?.code} ${t.class.name}` : "—",
      t.paidCount,
      t.unpaidCount,
      t.totalPaid,
    ]);
    const totalPaid = transactions.reduce((s, t) => s + t.totalPaid, 0);
    const totalRow = ["", "TOTAL", "", "", "", "", totalPaid];
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")), totalRow.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Student_Transactions_${filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Student Transactions Report" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint}>
            Print
          </Button>
        </div>
      </div>

      <div className="mb-4 print:block hidden print:mb-2">
        <h1 className="text-xl font-bold text-gray-900">Student Transactions Report</h1>
        <p className="text-sm text-gray-600">
          Year: {filterYear}
          {filterPaymentSemester ? ` | Payment semester: ${filterPaymentSemester}` : ""}
          {filterSearch.trim() && ` | Student: "${filterSearch.trim()}"`}
          {" | Generated: "}{new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <div className="no-print border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Filters</h3>
          <div className="flex flex-wrap gap-4">
            <div className="w-full sm:w-64">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Search Student</label>
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Name, Student ID, or phone"
                className="h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 dark:border-gray-700 dark:text-white/80 dark:placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Record year</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[120px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                {TX_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Payment semester</label>
              <select
                value={filterPaymentSemester}
                onChange={(e) => setFilterPaymentSemester(e.target.value)}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All semesters</option>
                {semestersTx.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Class semester</label>
              <select
                value={filterClassSemester}
                onChange={(e) => {
                  setFilterClassSemester(e.target.value);
                  setFilterClass("");
                }}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[130px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="all">Any</option>
                {semestersTx.map((s) => (
                  <option key={`c-${s.id}`} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Class year</label>
              <select
                value={filterClassYear}
                onChange={(e) => {
                  setFilterClassYear(e.target.value);
                  setFilterClass("");
                }}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[100px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="all">Any</option>
                {classYearOptions.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filterPaidOnly}
                  onChange={(e) => setFilterPaidOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600"
                />
                Paid students only
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Department</label>
              <select
                value={filterDept}
                onChange={(e) => {
                  setFilterDept(e.target.value);
                  setFilterClass("");
                }}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[180px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Class</label>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[200px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80"
              >
                <option value="">All Classes</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.department?.code} - {c.name} ({c.semester} {c.year})
                  </option>
                ))}
              </select>
            </div>
            <DateInput
              id="student-tx-date-from"
              label="Payment from"
              labelClassName="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
              value={filterDateFrom}
              onChange={setFilterDateFrom}
              inputClassName="h-10 w-full min-w-0 sm:w-auto sm:min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80 [color-scheme:light] dark:[color-scheme:dark]"
            />
            <DateInput
              id="student-tx-date-to"
              label="Payment to"
              labelClassName="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
              value={filterDateTo}
              onChange={setFilterDateTo}
              min={filterDateFrom || undefined}
              inputClassName="h-10 w-full min-w-0 sm:w-auto sm:min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/80 [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">Student transactions</h4>
            {!loading && transactions.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {transactions.length} students · Total paid{" "}
                <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                  ${transactions.reduce((s, t) => s + t.totalPaid, 0).toLocaleString()}
                </span>
              </p>
            )}
          </div>
          {!loading && paidByDept.categories.length > 0 && (
            <div className="no-print mb-6">
              <FinanceReportBarHorizontal
                title="Total paid by department"
                categories={paidByDept.categories}
                data={paidByDept.values}
                height={Math.min(380, 120 + paidByDept.categories.length * 26)}
              />
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Student ID</TableCell>
                    <TableCell isHeader>Name</TableCell>
                    <TableCell isHeader>Department</TableCell>
                    <TableCell isHeader>Class</TableCell>
                    <TableCell isHeader className="text-center">Semesters Paid</TableCell>
                    <TableCell isHeader className="text-center">Semesters Unpaid</TableCell>
                    <TableCell isHeader className="text-right">Total Paid</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((t) => (
                    <TableRow key={t.studentId}>
                      <TableCell>
                        <span className="no-print">
                          <Link href={`/students/${encodeURIComponent(t.studentId)}`} className="font-mono font-medium text-brand-600 hover:underline dark:text-brand-400">
                            {t.studentId}
                          </Link>
                        </span>
                        <span className="hidden print:inline font-mono font-medium text-gray-800">{t.studentId}</span>
                      </TableCell>
                      <TableCell>{t.firstName} {t.lastName}</TableCell>
                      <TableCell>{t.department?.name} ({t.department?.code})</TableCell>
                      <TableCell>{t.class ? `${t.class.department?.code} ${t.class.name}` : "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge color="success" size="sm">{t.paidCount}</Badge>
                        {t.paidSemesters.length > 0 && <span className="ml-1 text-xs text-gray-500">{t.paidSemesters.join(", ")}</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge color={t.unpaidCount > 0 ? "error" : "success"} size="sm">{t.unpaidCount}</Badge>
                        {t.unpaidSemesters.length > 0 && t.unpaidSemesters.length <= 3 && (
                          <span className="ml-1 text-xs text-gray-500">{t.unpaidSemesters.join(", ")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                        ${t.totalPaid.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactions.length > 0 && (
                    <TableRow className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                      <TableCell colSpan={6} className="text-right">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                        ${transactions.reduce((s, t) => s + t.totalPaid, 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                className="no-print"
                page={page}
                totalPages={totalPages}
                total={transactionsTotal}
                from={from}
                to={to}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
