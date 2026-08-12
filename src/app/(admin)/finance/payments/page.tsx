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
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/hooks/usePagination";
import { authFetch } from "@/lib/api";
import { FINANCE_HEADS, financeHeadLabel } from "@/lib/finance-head";
import { useAuth } from "@/context/AuthContext";
import { DollarLineIcon, ListIcon, TrashBinIcon } from "@/icons";

export type FinancePaymentRow = {
  id: number;
  amount: number;
  semester: string;
  year: number;
  financeHead: string;
  paymentMethod: string;
  receiptNumber: string | null;
  transactionId: string | null;
  paymentDate: string;
  paidAt: string;
  note: string | null;
  bank: { id: number; name: string; code: string } | null;
  method: { id: number; name: string } | null;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    department: { name: string; code: string };
    class: { name: string } | null;
  };
  recordedBy: { id: number; name: string; email: string } | null;
};

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

const CURRENT_YEAR = new Date().getFullYear();

const selectClassName =
  "h-10 min-w-[140px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white";

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "electronic":
      return "Electronic";
    case "cash_on_hand":
      return "Cash on Hand";
    default:
      return "Bank Receipt";
  }
}

function paymentReference(p: FinancePaymentRow) {
  if (p.paymentMethod === "bank_receipt" && p.receiptNumber) return p.receiptNumber;
  if (p.paymentMethod === "electronic" && p.transactionId) return p.transactionId;
  if (p.note?.trim()) return p.note.trim();
  return "—";
}

export default function FinancePaymentsPage() {
  const { hasPermission } = useAuth();
  const [financePayments, setFinancePayments] = useState<FinancePaymentRow[]>([]);
  const [financeTotal, setFinanceTotal] = useState(0);
  const [financePage, setFinancePage] = useState(1);
  const [financePageSize, setFinancePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [listError, setListError] = useState("");

  const [banks, setBanks] = useState<Bank[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);

  const [search, setSearch] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterBank, setFilterBank] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterHead, setFilterHead] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const canDeletePayment = hasPermission("finance.create");

  useEffect(() => {
    authFetch("/api/banks").then((r) => {
      if (r.ok) r.json().then((d) => setBanks(asList<Bank>(d)));
    });
    authFetch("/api/departments").then((r) => {
      if (r.ok) r.json().then((d) => setDepartments(asList<Department>(d)));
    });
    authFetch("/api/classes").then((r) => {
      if (r.ok) r.json().then((d) => setClasses(asList<ClassOption>(d)));
    });
    authFetch("/api/semesters?active=true").then((r) => {
      if (r.ok) r.json().then((d) => setSemesters(asList<SemesterOption>(d)));
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

  const buildFilterParams = useCallback(
    (opts?: { includeDates?: boolean }) => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (filterSemester) params.set("semester", filterSemester);
      if (filterYear) params.set("year", filterYear);
      if (filterDept) params.set("departmentId", filterDept);
      if (filterClass) params.set("classId", filterClass);
      if (filterBank) params.set("bankId", filterBank);
      if (filterMethod) params.set("paymentMethod", filterMethod);
      if (filterHead) params.set("financeHead", filterHead);
      if (opts?.includeDates !== false) {
        if (filterDateFrom) params.set("dateFrom", filterDateFrom);
        if (filterDateTo) params.set("dateTo", filterDateTo);
      }
      return params;
    },
    [
      search,
      filterSemester,
      filterYear,
      filterDept,
      filterClass,
      filterBank,
      filterMethod,
      filterHead,
      filterDateFrom,
      filterDateTo,
    ]
  );

  const fetchAvailableDates = useCallback(async () => {
    setLoadingDates(true);
    try {
      // Dates list ignores current start/end so options stay available while choosing a range.
      const params = buildFilterParams({ includeDates: false });
      params.set("datesOnly", "true");
      const res = await authFetch(`/api/tuition-payments?${params}`);
      if (!res.ok) {
        setAvailableDates([]);
        return;
      }
      const data = await res.json();
      const dates = Array.isArray(data.dates) ? (data.dates as string[]) : [];
      setAvailableDates(dates);
    } catch {
      setAvailableDates([]);
    } finally {
      setLoadingDates(false);
    }
  }, [buildFilterParams]);

  useEffect(() => {
    void fetchAvailableDates();
  }, [fetchAvailableDates]);

  useEffect(() => {
    if (filterDateFrom && availableDates.length > 0 && !availableDates.includes(filterDateFrom)) {
      setFilterDateFrom("");
    }
    if (filterDateTo && availableDates.length > 0 && !availableDates.includes(filterDateTo)) {
      setFilterDateTo("");
    }
  }, [availableDates, filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (filterDateFrom && filterDateTo && filterDateFrom > filterDateTo) {
      setFilterDateTo(filterDateFrom);
    }
  }, [filterDateFrom, filterDateTo]);

  const fetchFinancePayments = useCallback(
    async (opts?: { page?: number; pageSize?: number }) => {
      const page = opts?.page ?? financePage;
      const ps = opts?.pageSize ?? financePageSize;
      setFinanceLoading(true);
      setListError("");
      try {
        const params = buildFilterParams();
        params.set("page", String(page));
        params.set("pageSize", String(ps));

        const res = await authFetch(`/api/tuition-payments?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setFinancePayments([]);
          setFinanceTotal(0);
          setListError(data.error || "Failed to load payments");
          return;
        }
        setFinancePayments(Array.isArray(data.items) ? data.items : []);
        setFinanceTotal(typeof data.total === "number" ? data.total : 0);
      } catch {
        setFinancePayments([]);
        setFinanceTotal(0);
        setListError("Network error while loading payments");
      } finally {
        setFinanceLoading(false);
      }
    },
    [financePage, financePageSize, buildFilterParams]
  );

  useEffect(() => {
    void fetchFinancePayments();
  }, [fetchFinancePayments]);

  const financeTotalPages = Math.max(1, Math.ceil(financeTotal / financePageSize) || 1);
  const financeFrom = financeTotal === 0 ? 0 : (financePage - 1) * financePageSize + 1;
  const financeTo = Math.min(financePage * financePageSize, financeTotal);

  useEffect(() => {
    if (financeTotal > 0 && financePage > financeTotalPages) {
      setFinancePage(financeTotalPages);
    }
  }, [financeTotal, financePage, financeTotalPages]);

  const handleApplyFilters = () => {
    setFinancePage(1);
    void fetchFinancePayments({ page: 1 });
  };

  const handleClearFilters = () => {
    setSearch("");
    setFilterSemester("");
    setFilterYear("");
    setFilterDept("");
    setFilterClass("");
    setFilterBank("");
    setFilterMethod("");
    setFilterHead("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFinancePage(1);
  };

  useEffect(() => {
    if (filterClass && !filteredClasses.some((c) => c.id === Number(filterClass))) {
      setFilterClass("");
    }
  }, [filteredClasses, filterClass]);

  async function handleDeletePayment(p: FinancePaymentRow) {
    if (
      !confirm(
        `Remove this payment of $${Number(p.amount).toLocaleString()} for ${p.student.firstName} ${p.student.lastName} (${p.semester} ${p.year})? Student balance and bank balance will be reversed.`
      )
    ) {
      return;
    }
    setDeletingPaymentId(p.id);
    try {
      const res = await authFetch(`/api/tuition-payments/${p.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not delete payment");
        return;
      }
      await Promise.all([fetchFinancePayments(), fetchAvailableDates()]);
    } catch {
      alert("Could not delete payment");
    } finally {
      setDeletingPaymentId(null);
    }
  }

  if (!hasPermission("finance.view") && !hasPermission("admission.view") && !hasPermission("dashboard.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Payments" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">You do not have permission to view Payments.</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
      filterSemester ||
      filterYear ||
      filterDept ||
      filterClass ||
      filterBank ||
      filterMethod ||
      filterHead ||
      filterDateFrom ||
      filterDateTo
  );

  const endDateOptions = filterDateFrom
    ? availableDates.filter((d) => d >= filterDateFrom)
    : availableDates;

  return (
    <div>
      <PageBreadCrumb pageTitle="Payments" />

      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/finance" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Record payment
        </Link>
        <span className="text-gray-300 dark:text-gray-600" aria-hidden>
          ·
        </span>
        <Link href="/finance/banks" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Manage banks
        </Link>
        <span className="text-gray-300 dark:text-gray-600" aria-hidden>
          ·
        </span>
        <Link href="/finance/payment-methods" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Payment methods
        </Link>
        <span className="text-gray-300 dark:text-gray-600" aria-hidden>
          ·
        </span>
        <Link href="/reports/finance-heads" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Finance head report
        </Link>
        <span className="text-gray-300 dark:text-gray-600" aria-hidden>
          ·
        </span>
        <Link href="/reports/payment" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Finance reports
        </Link>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/3">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <ListIcon className="h-5 w-5 shrink-0 text-brand-500" />
            Tuition payments
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Search and filter recorded tuition payments. Date filters use payment dates from the
            list (works after class upgrades when filtering by class).
          </p>
        </div>

        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Search student
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              placeholder="Name, student ID, or phone"
              className="h-10 w-full max-w-md rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Semester
              </label>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className={selectClassName}
              >
                <option value="">All</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Year
              </label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className={selectClassName}
              >
                <option value="">All</option>
                {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
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
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Class
              </label>
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
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Bank
              </label>
              <select
                value={filterBank}
                onChange={(e) => setFilterBank(e.target.value)}
                className={`${selectClassName} min-w-[160px]`}
              >
                <option value="">All</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Finance head
              </label>
              <select
                value={filterHead}
                onChange={(e) => setFilterHead(e.target.value)}
                className={`${selectClassName} min-w-[160px]`}
              >
                <option value="">All</option>
                {FINANCE_HEADS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Method
              </label>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className={selectClassName}
              >
                <option value="">All</option>
                <option value="bank_receipt">Bank receipt</option>
                <option value="electronic">Electronic</option>
                <option value="cash_on_hand">Cash</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Start Date
              </label>
              <select
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                disabled={loadingDates}
                className={`${selectClassName} min-w-[160px] disabled:opacity-50`}
              >
                <option value="">Any date</option>
                {availableDates.map((d) => (
                  <option key={`from-${d}`} value={d}>
                    {formatDateLabel(d)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                End Date
              </label>
              <select
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                disabled={loadingDates}
                className={`${selectClassName} min-w-[160px] disabled:opacity-50`}
              >
                <option value="">Any date</option>
                {endDateOptions.map((d) => (
                  <option key={`to-${d}`} value={d}>
                    {formatDateLabel(d)}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={handleApplyFilters}>
              Apply
            </Button>
            {hasActiveFilters && (
              <Button size="sm" variant="outline" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
          </div>
          {loadingDates ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loading payment dates…</p>
          ) : availableDates.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              No payment dates available for the current filters.
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {availableDates.length} payment date{availableDates.length === 1 ? "" : "s"} available
              for selection.
            </p>
          )}
          {listError && (
            <p className="mt-2 text-xs text-error-500">{listError}</p>
          )}
        </div>

        <div className="p-0">
          {financeLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
            </div>
          ) : financeTotal === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <DollarLineIcon className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {hasActiveFilters ? "No payments match your filters." : "No tuition payments recorded yet."}
              </p>
              {!hasActiveFilters && (
                <Link
                  href="/finance"
                  className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  Record a payment
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader>Date</TableCell>
                      <TableCell isHeader>Student</TableCell>
                      <TableCell isHeader>Semester</TableCell>
                      <TableCell isHeader>Finance Head</TableCell>
                      <TableCell isHeader className="text-right">
                        Amount
                      </TableCell>
                      <TableCell isHeader>Method</TableCell>
                      <TableCell isHeader>Bank</TableCell>
                      <TableCell isHeader>Reference</TableCell>
                      <TableCell isHeader>Recorded by</TableCell>
                      {canDeletePayment && (
                        <TableCell isHeader className="text-right">
                          Actions
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financePayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/students/${encodeURIComponent(p.student.studentId)}`}
                            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                          >
                            {p.student.firstName} {p.student.lastName}
                          </Link>
                          <span className="ml-1 font-mono text-xs text-gray-500 dark:text-gray-400">
                            {p.student.studentId}
                          </span>
                        </TableCell>
                        <TableCell>
                          {p.semester} {p.year}
                        </TableCell>
                        <TableCell>{financeHeadLabel(p.financeHead)}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                          ${Number(p.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>{p.method?.name || paymentMethodLabel(p.paymentMethod)}</TableCell>
                        <TableCell>
                          {p.bank ? `${p.bank.code} · ${p.bank.name}` : "—"}
                        </TableCell>
                        <TableCell className="max-w-[140px] text-gray-600 dark:text-gray-300">
                          <span className="block truncate" title={paymentReference(p)}>
                            {paymentReference(p)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {p.recordedBy?.name || "—"}
                        </TableCell>
                        {canDeletePayment && (
                          <TableCell className="text-right">
                            <button
                              type="button"
                              onClick={() => void handleDeletePayment(p)}
                              disabled={deletingPaymentId === p.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-500 disabled:opacity-50 dark:hover:bg-error-500/10"
                              aria-label="Delete payment"
                              title="Delete payment (reverses balance)"
                            >
                              <TrashBinIcon className="h-4 w-4" />
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={financePage}
                totalPages={financeTotalPages}
                total={financeTotal}
                from={financeFrom}
                to={financeTo}
                pageSize={financePageSize}
                onPageChange={setFinancePage}
                onPageSizeChange={setFinancePageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
