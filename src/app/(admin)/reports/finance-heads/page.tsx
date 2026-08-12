"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { DateInput } from "@/components/form/DateInput";
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
import { FINANCE_HEADS, financeHeadLabel } from "@/lib/finance-head";
import { DEFAULT_PROGRAM, type Program } from "@/lib/program";
import { ReportExportButtons } from "@/components/reports/ReportExportButtons";
import { ReportProgramFilter } from "@/components/reports/ReportProgramFilter";
import {
  FinanceReportBar,
  FinanceReportDonut,
  FinanceReportChartGrid,
} from "@/components/reports/FinanceReportChart";

type Bank = { id: number; name: string; code: string };
type Department = { id: number; name: string; code: string };
type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  department: { id: number; code: string };
};
type SemesterOption = { id: number; name: string };

type ReportPayment = {
  id: number;
  amount: number;
  financeHead: string;
  financeHeadLabel: string;
  semester: string;
  year: number;
  paymentDate: string;
  receiptNumber: string | null;
  note: string | null;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    department: { name: string; code: string };
    class: { name: string } | null;
  };
  bank: { id: number; name: string; code: string } | null;
  method: { id: number; name: string } | null;
  recordedBy: { name: string | null; email: string } | null;
};

type ReportData = {
  summary: {
    totalAmount: number;
    totalCount: number;
    byHead: { financeHead: string; label: string; total: number; count: number }[];
  };
  payments: ReportPayment[];
};

const CURRENT_YEAR = new Date().getFullYear();
const selectClassName =
  "h-10 min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white";

export default function FinanceHeadReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [program, setProgram] = useState<Program>(DEFAULT_PROGRAM);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);

  const [search, setSearch] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterBank, setFilterBank] = useState("");
  const [filterHead, setFilterHead] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    authFetch("/api/banks").then((r) => {
      if (r.ok) r.json().then((d: Bank[]) => setBanks(Array.isArray(d) ? d : []));
    });
    authFetch("/api/departments").then((r) => {
      if (r.ok) r.json().then((d: Department[]) => setDepartments(Array.isArray(d) ? d : []));
    });
    authFetch("/api/classes").then((r) => {
      if (r.ok) r.json().then((d: ClassOption[]) => setClasses(Array.isArray(d) ? d : []));
    });
    authFetch("/api/semesters?active=true").then((r) => {
      if (r.ok) r.json().then((d: SemesterOption[]) => setSemesters(Array.isArray(d) ? d : []));
    });
  }, []);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (filterDept && c.department?.id !== Number(filterDept)) return false;
      if (filterSemester && c.semester !== filterSemester) return false;
      if (filterYear && c.year !== Number(filterYear)) return false;
      return true;
    });
  }, [classes, filterDept, filterSemester, filterYear]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ program });
    if (search.trim()) params.set("search", search.trim());
    if (filterSemester) params.set("semester", filterSemester);
    if (filterYear) params.set("year", filterYear);
    if (filterDept) params.set("departmentId", filterDept);
    if (filterClass) params.set("classId", filterClass);
    if (filterBank) params.set("bankId", filterBank);
    if (filterHead) params.set("financeHead", filterHead);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params;
  }, [
    program,
    search,
    filterSemester,
    filterYear,
    filterDept,
    filterClass,
    filterBank,
    filterHead,
    dateFrom,
    dateTo,
  ]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/finance/finance-head-report?${buildParams()}`);
      const json = await res.json();
      if (!res.ok) {
        setData(null);
        setError(json.error || "Failed to load report");
        return;
      }
      setData(json);
    } catch {
      setData(null);
      setError("Network error while loading report");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const payments = data?.payments ?? [];
  const summary = data?.summary;
  const headSummary = summary?.byHead.filter((h) => h.count > 0) ?? [];

  const {
    paginatedItems: paginatedPayments,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: paymentsTotal,
    from,
    to,
  } = usePagination(payments, [data]);

  const chartData = useMemo(() => {
    const active = headSummary.filter((h) => h.total > 0);
    return {
      categories: active.map((h) => h.label),
      values: active.map((h) => h.total),
    };
  }, [headSummary]);

  const filterSubtitle = [
    program,
    filterHead ? financeHeadLabel(filterHead) : null,
    filterSemester && filterYear ? `${filterSemester} ${filterYear}` : filterSemester || filterYear || null,
    dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const exportHeaders = [
    "Date",
    "Student",
    "Student ID",
    "Department",
    "Finance Head",
    "Semester",
    "Amount",
    "Bank",
    "Payment Method",
    "Reference",
    "Recorded By",
  ];
  const exportRows = payments.map((p) => [
    new Date(p.paymentDate).toLocaleDateString(),
    `${p.student.firstName} ${p.student.lastName}`,
    p.student.studentId,
    p.student.department?.code ?? "",
    p.financeHeadLabel,
    `${p.semester} ${p.year}`,
    p.amount.toFixed(2),
    p.bank ? `${p.bank.code}` : "",
    p.method?.name ?? "",
    p.receiptNumber || p.note || "",
    p.recordedBy?.name || p.recordedBy?.email || "",
  ]);
  const exportFooterRows: (string | number)[][] = [
    [],
    ["Finance head", "Payments", "Total"],
    ...headSummary.map((h) => [h.label, h.count, h.total.toFixed(2)]),
    [],
    ["Grand total", summary?.totalCount ?? 0, (summary?.totalAmount ?? 0).toFixed(2)],
  ];

  const handlePrint = () => window.print();

  return (
    <div className="report-print-area">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <PageBreadCrumb pageTitle="Finance Head Report" />
        <div className="flex flex-wrap items-center gap-2">
          <ReportProgramFilter
            value={program}
            onChange={setProgram}
            className={selectClassName}
          />
          <Link href="/reports/payment">
            <Button variant="outline" size="sm">
              ← All Reports
            </Button>
          </Link>
          <ReportExportButtons
            title="Finance Head Report"
            filename={`Finance_Heads_${dateFrom}_to_${dateTo}`}
            subtitle={filterSubtitle}
            headers={exportHeaders}
            rows={exportRows}
            footerRows={exportFooterRows}
            disabled={loading || payments.length === 0}
            onPrint={handlePrint}
          />
        </div>
      </div>

      <div className="mb-4 print:block hidden">
        <h1 className="text-xl font-bold text-gray-900">Finance Head Report</h1>
        <p className="text-sm text-gray-600">{filterSubtitle}</p>
      </div>

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
            <label className="mb-1 block text-xs font-medium text-gray-500">Finance head</label>
            <select value={filterHead} onChange={(e) => setFilterHead(e.target.value)} className={selectClassName}>
              <option value="">All heads</option>
              {FINANCE_HEADS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Semester</label>
            <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} className={selectClassName}>
              <option value="">All</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Year</label>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className={selectClassName}>
              <option value="">All</option>
              {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
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
            <label className="mb-1 block text-xs font-medium text-gray-500">Class</label>
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className={`${selectClassName} min-w-[180px]`}>
              <option value="">All</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.department?.code ?? "—"} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Bank</label>
            <select value={filterBank} onChange={(e) => setFilterBank(e.target.value)} className={`${selectClassName} min-w-[160px]`}>
              <option value="">All</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>
          <DateInput
            id="fh-report-from"
            label={<span className="text-xs font-medium text-gray-500">From</span>}
            labelClassName="mb-1 block"
            value={dateFrom}
            onChange={setDateFrom}
            inputClassName={selectClassName}
          />
          <DateInput
            id="fh-report-to"
            label={<span className="text-xs font-medium text-gray-500">To</span>}
            labelClassName="mb-1 block"
            value={dateTo}
            onChange={setDateTo}
            inputClassName={selectClassName}
          />
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
            <div className="grid gap-4 border-b border-gray-200 p-6 sm:grid-cols-3 dark:border-gray-800">
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-white/3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total collected</p>
                <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                  ${summary.totalAmount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-white/3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Payments</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summary.totalCount}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-white/3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Finance heads</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{headSummary.length}</p>
              </div>
            </div>

            {chartData.categories.length > 0 && (
              <div className="border-b border-gray-200 px-6 py-6 dark:border-gray-800">
                <FinanceReportChartGrid>
                  <FinanceReportDonut
                    title="Revenue by finance head"
                    labels={chartData.categories}
                    series={chartData.values}
                  />
                  <FinanceReportBar
                    title="Amount by finance head"
                    categories={chartData.categories}
                    data={chartData.values}
                    color="#2563eb"
                  />
                </FinanceReportChartGrid>
              </div>
            )}

            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Summary by finance head</h3>
            </div>
            <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-800">
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Finance Head</TableCell>
                    <TableCell isHeader className="text-center">Payments</TableCell>
                    <TableCell isHeader className="text-right">Total</TableCell>
                    <TableCell isHeader className="text-right">Share</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-gray-500">
                        No payments match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    headSummary.map((h) => (
                      <TableRow key={h.financeHead}>
                        <TableCell className="font-medium">{h.label}</TableCell>
                        <TableCell className="text-center">{h.count}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                          ${h.total.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 dark:text-gray-400">
                          {summary.totalAmount > 0
                            ? `${((h.total / summary.totalAmount) * 100).toFixed(1)}%`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Payment details</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                All recorded payments for the selected filters (up to 5,000 rows).
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-transparent! hover:bg-transparent!">
                    <TableCell isHeader>Date</TableCell>
                    <TableCell isHeader>Student</TableCell>
                    <TableCell isHeader>Finance Head</TableCell>
                    <TableCell isHeader>Term</TableCell>
                    <TableCell isHeader className="text-right">Amount</TableCell>
                    <TableCell isHeader>Bank</TableCell>
                    <TableCell isHeader>Method</TableCell>
                    <TableCell isHeader>Reference</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-gray-500">
                        No payments in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {p.student.firstName} {p.student.lastName}
                          </span>
                          <span className="ml-1 font-mono text-xs text-gray-500">{p.student.studentId}</span>
                        </TableCell>
                        <TableCell>{p.financeHeadLabel}</TableCell>
                        <TableCell>
                          {p.semester} {p.year}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                          ${Number(p.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>{p.bank?.code ?? "—"}</TableCell>
                        <TableCell>{p.method?.name ?? "—"}</TableCell>
                        <TableCell className="max-w-[120px] truncate">
                          <span title={p.receiptNumber || p.note || ""}>
                            {p.receiptNumber || p.note || "—"}
                          </span>
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
                total={paymentsTotal}
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
