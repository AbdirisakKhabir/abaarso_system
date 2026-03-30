"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
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
import { DateInput } from "@/components/form/DateInput";
import { usePagination, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/hooks/usePagination";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  DownloadIcon,
  DollarLineIcon,
  UserCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  CalenderIcon,
  AlertIcon,
} from "@/icons";

type Bank = { id: number; name: string; code: string; balance: number; accountNumber?: string | null };
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
  tuitionFee: number | null;
  paymentStatus?: string;
};
type FinancePaymentRow = {
  id: number;
  amount: number;
  semester: string;
  year: number;
  paymentMethod: string;
  receiptNumber: string | null;
  transactionId: string | null;
  paymentDate: string;
  paidAt: string;
  note: string | null;
  bank: { id: number; name: string; code: string } | null;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    department: { name: string; code: string };
  };
  recordedBy: { id: number; name: string; email: string } | null;
};

type SearchStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  balance: number;
  paymentStatus: string;
  department: { name: string; code: string; tuitionFee: number | null };
  class: { name: string; semester: string; year: number; department: { code: string } } | null;
  tuitionPayments: { semester: string; year: number; amount: number }[];
};

const CURRENT_YEAR = new Date().getFullYear();

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

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Record Payment Form
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SearchStudent | null>(null);
  const [payBankId, setPayBankId] = useState("");
  const [paySemester, setPaySemester] = useState("");
  const [payYear, setPayYear] = useState(String(CURRENT_YEAR));
  const [payAmountType, setPayAmountType] = useState<"half" | "full" | "custom">("full");
  const [payAmount, setPayAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "bank_receipt" | "electronic" | "cash_on_hand"
  >("bank_receipt");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const [paySuccess, setPaySuccess] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Finance list (paginated tuition payments)
  const [financePayments, setFinancePayments] = useState<FinancePaymentRow[]>([]);
  const [financeTotal, setFinanceTotal] = useState(0);
  const [financePage, setFinancePage] = useState(1);
  const [financePageSize, setFinancePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [financeLoading, setFinanceLoading] = useState(false);

  // Unpaid students
  const [unpaidSemester, setUnpaidSemester] = useState("");
  const [unpaidYear, setUnpaidYear] = useState(String(CURRENT_YEAR));
  const [unpaidClassId, setUnpaidClassId] = useState("");
  const [unpaidStudents, setUnpaidStudents] = useState<UnpaidStudent[]>([]);
  const [unpaidClassInfo, setUnpaidClassInfo] = useState<{ name: string; semester: string; year: number; department: { code: string; name: string } } | null>(null);
  const [unpaidLoading, setUnpaidLoading] = useState(false);

  const canRecordPayment = hasPermission("finance.create") || hasPermission("finance.view");

  useEffect(() => {
    authFetch("/api/banks").then((r) => {
      if (r.ok) r.json().then((d: Bank[]) => {
        setBanks(d);
        if (d.length > 0 && !payBankId) setPayBankId(String(d[0].id));
      });
    });
    authFetch("/api/semesters?active=true").then((r) => {
      if (r.ok) r.json().then((d: SemesterOption[]) => {
        setSemesters(d);
        if (d.length > 0 && !paySemester) setPaySemester(d[0].name);
        if (d.length > 0 && !unpaidSemester) setUnpaidSemester(d[0].name);
      });
    });
    authFetch("/api/classes").then((r) => {
      if (r.ok) r.json().then((d: ClassOption[]) => setClasses(d));
    });
  }, []);

  useEffect(() => {
    if (banks.length > 0 && !payBankId) setPayBankId(String(banks[0].id));
  }, [banks, payBankId]);

  useEffect(() => {
    if (semesters.length > 0 && !paySemester) setPaySemester(semesters[0].name);
  }, [semesters, paySemester]);

  useEffect(() => {
    if (semesters.length > 0 && !unpaidSemester) setUnpaidSemester(semesters[0].name);
  }, [semesters, unpaidSemester]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await authFetch(`/api/students/search?q=${encodeURIComponent(q)}&limit=15`);
        if (res.ok) setSearchResults(await res.json());
        else setSearchResults([]);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const fetchFinancePayments = useCallback(
    async (opts?: { page?: number; pageSize?: number }) => {
      const page = opts?.page ?? financePage;
      const ps = opts?.pageSize ?? financePageSize;
      setFinanceLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(ps),
        });
        const res = await authFetch(`/api/tuition-payments?${params}`);
        if (res.ok) {
          const data = await res.json();
          setFinancePayments(Array.isArray(data.items) ? data.items : []);
          setFinanceTotal(typeof data.total === "number" ? data.total : 0);
        } else {
          setFinancePayments([]);
          setFinanceTotal(0);
        }
      } catch {
        setFinancePayments([]);
        setFinanceTotal(0);
      } finally {
        setFinanceLoading(false);
      }
    },
    [financePage, financePageSize]
  );

  useEffect(() => {
    void fetchFinancePayments();
  }, [fetchFinancePayments]);

  const filteredClasses = classes.filter(
    (c) => c.semester === unpaidSemester && c.year === Number(unpaidYear)
  );

  useEffect(() => {
    if (unpaidClassId && !filteredClasses.some((c) => c.id === Number(unpaidClassId))) {
      setUnpaidClassId("");
    }
  }, [filteredClasses, unpaidClassId]);

  const tuitionFee = selectedStudent?.department?.tuitionFee ?? 0;
  const expectedFull = selectedStudent?.paymentStatus === "Full Scholarship" ? 0
    : selectedStudent?.paymentStatus === "Half Scholar" ? tuitionFee * 0.5
    : tuitionFee;
  const computedAmount = payAmountType === "half" ? expectedFull * 0.5
    : payAmountType === "full" ? expectedFull
    : payAmount ? Number(payAmount) : expectedFull;

  useEffect(() => {
    if (selectedStudent) {
      if (payAmountType === "full") setPayAmount(String(expectedFull));
      else if (payAmountType === "half") setPayAmount(String(expectedFull * 0.5));
    }
  }, [selectedStudent, payAmountType, expectedFull]);

  const handleSelectStudent = (s: SearchStudent) => {
    setSelectedStudent(s);
    setSearchResults([]);
    setSearchQuery(`${s.firstName} ${s.lastName} (${s.studentId})`);
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setSearchQuery("");
  };

  const handleGenerateUnpaid = async () => {
    if (!unpaidSemester || !unpaidYear || !unpaidClassId) return;
    setUnpaidLoading(true);
    setUnpaidClassInfo(null);
    setUnpaidStudents([]);
    try {
      const params = new URLSearchParams({
        semester: unpaidSemester,
        year: unpaidYear,
        classId: unpaidClassId,
      });
      const res = await authFetch(`/api/finance/unpaid-students?${params}`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to load unpaid students");
        return;
      }
      setUnpaidClassInfo(data.class);
      setUnpaidStudents(data.unpaidStudents || []);
    } catch {
      alert("Network error");
    } finally {
      setUnpaidLoading(false);
    }
  };

  const handleExportUnpaidCSV = () => {
    if (unpaidStudents.length === 0) return;
    const headers = ["Student ID", "First Name", "Last Name", "Email", "Phone", "Department", "Tuition Fee"];
    const rows = unpaidStudents.map((s) => [
      s.studentId,
      s.firstName,
      s.lastName,
      s.email || "",
      s.phone || "",
      `${s.department.code} - ${s.department.name}`,
      s.tuitionFee != null ? String(s.tuitionFee) : "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Unpaid_Students_${unpaidClassInfo?.department?.code || "class"}_${unpaidSemester}_${unpaidYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError("");
    setPaySuccess(false);
    if (!selectedStudent || !payBankId) {
      setPayError("Please select a student and bank");
      return;
    }
    if (paymentMethod === "bank_receipt" && !receiptNumber.trim()) {
      setPayError("Receipt number is required for bank deposit");
      return;
    }
    if (paymentMethod === "electronic" && !transactionId.trim()) {
      setPayError("Transaction ID is required for electronic payment");
      return;
    }
    setPaySubmitting(true);
    try {
      const res = await authFetch("/api/tuition-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.studentId,
          semester: paySemester,
          year: Number(payYear),
          amount: computedAmount,
          bankId: Number(payBankId),
          paymentMethod,
          receiptNumber:
            paymentMethod === "bank_receipt" ? receiptNumber.trim() : undefined,
          transactionId:
            paymentMethod === "electronic" ? transactionId.trim() : undefined,
          paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
          note: payNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayError(data.error || "Payment failed");
        return;
      }
      setPaySuccess(true);
      handleClearStudent();
      setPayAmount("");
      setReceiptNumber("");
      setTransactionId("");
      setPayNote("");
      setFinancePage(1);
      void fetchFinancePayments({ page: 1 });
      authFetch("/api/banks").then((r) => { if (r.ok) r.json().then(setBanks); });
    } catch {
      setPayError("Network error");
    } finally {
      setPaySubmitting(false);
    }
  };

  const {
    paginatedItems: paginatedUnpaidStudents,
    page: unpaidPage,
    setPage: setUnpaidPage,
    pageSize: unpaidPageSize,
    setPageSize: setUnpaidPageSize,
    totalPages: unpaidTotalPages,
    total: unpaidTotal,
    from: unpaidFrom,
    to: unpaidTo,
  } = usePagination(unpaidStudents, [unpaidClassId, unpaidSemester, unpaidYear]);

  const financeTotalPages = Math.max(1, Math.ceil(financeTotal / financePageSize) || 1);
  const financeFrom =
    financeTotal === 0 ? 0 : (financePage - 1) * financePageSize + 1;
  const financeTo = Math.min(financePage * financePageSize, financeTotal);

  useEffect(() => {
    if (financeTotal > 0 && financePage > financeTotalPages) {
      setFinancePage(financeTotalPages);
    }
  }, [financeTotal, financePage, financeTotalPages]);

  if (!hasPermission("finance.view") && !hasPermission("admission.view") && !hasPermission("dashboard.view")) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Finance" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">You do not have permission to view Finance.</p>
        </div>
      </div>
    );
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition-all placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500 dark:focus:ring-brand-500/20";
  const selectClass =
    "h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:focus:border-brand-500 dark:focus:ring-brand-500/20";

  const studentInitials = selectedStudent
    ? `${selectedStudent.firstName?.[0] ?? ""}${selectedStudent.lastName?.[0] ?? ""}`.toUpperCase() || "?"
    : "";

  return (
    <div>
      <PageBreadCrumb pageTitle="Finance" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Record bank deposits and tuition payments.{" "}
          <Link href="/finance/banks" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Manage Banks
          </Link>
          {" · "}
          <Link href="/reports/payment" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Finance Reports
          </Link>
        </p>
      </div>

      {/* Record tuition payment — stepped form */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xl shadow-gray-200/40 ring-1 ring-black/[0.03] dark:border-gray-800 dark:bg-white/[0.03] dark:shadow-none dark:ring-white/5">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-600 to-brand-800 px-6 py-5 sm:px-8 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 left-1/4 h-24 w-48 rounded-full bg-brand-400/20 blur-xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20">
                <DollarLineIcon className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Record a tuition payment
                </h3>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/85">
                  Match the student, choose the semester you are paying for, then enter how they paid and
                  any proof. The student&apos;s balance and the selected bank&apos;s balance will update.
                </p>
              </div>
            </div>
            <div className="mt-2 flex shrink-0 flex-wrap gap-2 text-xs text-white/80 sm:mt-0 sm:flex-col sm:text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                <span className="text-sm font-semibold text-white">1</span> Student
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                <span className="text-sm font-semibold text-white">2</span> Period &amp; bank
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                <span className="text-sm font-semibold text-white">3</span> Amount &amp; method
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleRecordPayment} className="p-6 sm:p-8">
          <div className="mx-auto max-w-3xl space-y-8">
            {payError && (
              <div
                role="alert"
                className="flex gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3.5 text-sm text-red-800 dark:border-red-800/50 dark:bg-red-500/10 dark:text-red-300"
              >
                <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />
                <span>{payError}</span>
              </div>
            )}
            {paySuccess && (
              <div className="flex gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">Payment saved</p>
                  <p className="mt-0.5 text-emerald-800/90 dark:text-emerald-300/90">
                    The student&apos;s balance and the bank account balance have been updated.
                  </p>
                </div>
              </div>
            )}

            {/* Step 1 — Student */}
            <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white shadow-sm">
                  1
                </span>
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white">Which student?</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Type at least two characters to search by name, phone, or student ID.
                  </p>
                </div>
              </div>
              <div className="relative">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <UserCircleIcon className="h-4 w-4 text-brand-500" />
                  Student <span className="text-error-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!e.target.value) setSelectedStudent(null);
                    }}
                    placeholder="e.g. Ali, 252..., or STD-2026-0001"
                    className={`${inputClass} pr-12`}
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    {searchResults.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectStudent(s)}
                        className="flex w-full flex-col gap-0.5 border-b border-gray-100 px-4 py-3.5 text-left transition-colors hover:bg-brand-50 dark:border-gray-800 dark:hover:bg-brand-500/10 last:border-0"
                      >
                        <span className="font-medium text-gray-800 dark:text-white/90">
                          {s.firstName} {s.lastName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {s.studentId} · {s.department?.code} · Balance: ${(s.balance ?? 0).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedStudent && (
                <div className="relative mt-5 overflow-hidden rounded-2xl border border-brand-200/80 bg-gradient-to-br from-brand-50/90 to-white p-5 dark:from-brand-500/15 dark:to-gray-900/60 dark:border-brand-500/35">
                  <div className="absolute right-0 top-0 h-28 w-28 translate-x-6 -translate-y-6 rounded-full bg-brand-400/10 dark:bg-brand-400/5" />
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-lg font-bold text-white shadow-md shadow-brand-500/25"
                        aria-hidden
                      >
                        {studentInitials}
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedStudent.firstName} {selectedStudent.lastName}
                        </p>
                        <p className="font-mono text-sm text-brand-600 dark:text-brand-400">{selectedStudent.studentId}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <span>{selectedStudent.department?.name}</span>
                          <span className="text-gray-400 dark:text-gray-500">·</span>
                          <span>
                            Outstanding balance:{" "}
                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                              ${(selectedStudent.balance ?? 0).toLocaleString()}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleClearStudent}>
                      Choose someone else
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* Step 2 — Period & bank */}
            <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white shadow-sm">
                  2
                </span>
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white">Payment period &amp; deposit account</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This payment applies to one semester and year. Money is credited to the bank you choose.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Deposit to bank <span className="text-error-500">*</span>
                  </label>
                  <p className="mb-2 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                    Use this to match where the money was received (including a petty-cash or “cash on hand” account if you have one).
                  </p>
                  <select
                    value={payBankId}
                    onChange={(e) => setPayBankId(e.target.value)}
                    required
                    className={selectClass}
                  >
                    <option value="">Choose a bank account…</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
                    <select value={paySemester} onChange={(e) => setPaySemester(e.target.value)} className={selectClass}>
                      {semesters.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Academic year</label>
                    <input
                      type="number"
                      value={payYear}
                      onChange={(e) => setPayYear(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <DateInput
                    id="finance-payment-date"
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        <CalenderIcon className="h-3.5 w-3.5 text-brand-500" />
                        Payment date
                      </span>
                    }
                    labelClassName="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    value={paymentDate}
                    onChange={setPaymentDate}
                    inputClassName={inputClass}
                  />
                </div>
              </div>
            </section>

            {/* Step 3 — Amount & method */}
            <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white shadow-sm">
                  3
                </span>
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white">How much &amp; how they paid</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Amounts follow the student&apos;s tuition and scholarship rules. Pick how the money was received.
                  </p>
                </div>
              </div>

              {selectedStudent && expectedFull === 0 && (
                <div className="mb-4 flex gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>This student has no tuition due for this period (e.g. full scholarship). Confirm the amount before saving.</span>
                </div>
              )}

              <div className="mb-4">
                <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">Tuition amount</label>
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { value: "full" as const, label: "Full semester", amount: `$${expectedFull.toLocaleString()}` },
                    { value: "half" as const, label: "Half", amount: `$${(expectedFull * 0.5).toLocaleString()}` },
                    { value: "custom" as const, label: "Custom", amount: "" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-3 transition-all ${
                        payAmountType === opt.value
                          ? "border-brand-500 bg-white shadow-sm ring-1 ring-brand-500/20 dark:border-brand-500 dark:bg-brand-500/15"
                          : "border-gray-200 bg-white/60 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="amountType"
                        checked={payAmountType === opt.value}
                        onChange={() => setPayAmountType(opt.value)}
                        className="sr-only"
                      />
                      <span className="font-medium text-gray-800 dark:text-white/90">{opt.label}</span>
                      {opt.amount ? (
                        <span className="text-sm text-gray-500 dark:text-gray-400">{opt.amount}</span>
                      ) : null}
                    </label>
                  ))}
                  {payAmountType === "custom" && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-11 w-32 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-white px-4 py-3 dark:border-brand-500/25 dark:bg-gray-900/70">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total you will record</span>
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500">→</span>
                  <span className="text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
                    ${Number(computedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200/80 pt-5 dark:border-gray-700">
                <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">Payment method</label>
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  We need the right reference field depending on how the family paid.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { value: "bank_receipt" as const, label: "Bank receipt", desc: "Deposit slip or receipt from a bank branch" },
                    { value: "electronic" as const, label: "Electronic", desc: "Mobile money, card, or online transfer" },
                    { value: "cash_on_hand" as const, label: "Cash on hand", desc: "Physical cash received at your office" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 px-4 py-3.5 transition-all ${
                        paymentMethod === opt.value
                          ? "border-brand-500 bg-white shadow-sm ring-1 ring-brand-500/20 dark:border-brand-500 dark:bg-brand-500/15"
                          : "border-gray-200 bg-white/60 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === opt.value}
                        onChange={() => setPaymentMethod(opt.value)}
                        className="sr-only"
                      />
                      <span className="font-semibold text-gray-800 dark:text-white/90">{opt.label}</span>
                      <span className="text-xs leading-snug text-gray-500 dark:text-gray-400">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Proof of payment
                </p>
                {paymentMethod === "bank_receipt" ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Receipt number <span className="text-error-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      placeholder="As printed on the bank receipt"
                      className={inputClass}
                    />
                  </div>
                ) : paymentMethod === "electronic" ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Transaction or reference ID <span className="text-error-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="From SMS, email, or banking app"
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    No receipt or transaction ID is required for cash. Add an internal note below if you want a
                    reference on file.
                  </p>
                )}
              </div>
            </section>

            {/* Note & submit */}
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Internal note (optional)</label>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                Visible only to staff — e.g. &quot;Brought by parent&quot;, or extra context for cash.
              </p>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Optional note for your team"
                className={inputClass}
              />
              <div className="mt-6 flex flex-col gap-4 border-t border-gray-100 pt-6 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {canRecordPayment
                    ? "You have permission to record payments."
                    : "You can view this form but cannot submit payments."}
                </p>
                <Button
                  type="submit"
                  disabled={!selectedStudent || !payBankId || paySubmitting || !canRecordPayment}
                  className="min-w-[200px] rounded-xl px-6 py-2.5 text-base font-semibold shadow-md shadow-brand-500/20"
                >
                  {paySubmitting ? "Saving…" : "Save payment"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Finance list — recent tuition payments */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            <DollarLineIcon className="h-5 w-5 text-brand-500" />
            Finance — Recent Payments
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tuition payments recorded in the system (newest first).
          </p>
        </div>
        <div className="p-0">
          {financeLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
            </div>
          ) : financeTotal === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No tuition payments recorded yet.
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
                      <TableCell isHeader className="text-right">Amount</TableCell>
                      <TableCell isHeader>Method</TableCell>
                      <TableCell isHeader>Bank</TableCell>
                      <TableCell isHeader>Reference</TableCell>
                      <TableCell isHeader>Recorded by</TableCell>
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
                        <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                          ${Number(p.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>{paymentMethodLabel(p.paymentMethod)}</TableCell>
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

      {/* Bank Balances Summary */}
      {banks.length > 0 && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              <DollarLineIcon className="h-5 w-5 text-brand-500" />
              Bank Balances
            </h3>
          </div>
          <div className="flex flex-wrap gap-4 p-6">
            {banks.map((b) => (
              <div
                key={b.id}
                className="flex flex-1 min-w-[200px] items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white px-5 py-4 dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-900/50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{b.code}</p>
                  <p className="font-semibold text-gray-800 dark:text-white/90">{b.name}</p>
                  <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                    ${(b.balance ?? 0).toLocaleString()}
                  </p>
                </div>
                <Link href="/finance/banks">
                  <Button variant="outline" size="sm">Manage</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unpaid Students */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            <UserCircleIcon className="h-5 w-5 text-brand-500" />
            Unpaid Students by Semester & Class
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select semester, year, and class to generate a list of students who have not paid tuition.
          </p>
        </div>
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Semester</label>
              <select
                value={unpaidSemester}
                onChange={(e) => setUnpaidSemester(e.target.value)}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[120px] rounded-xl border border-gray-200 bg-gray-50/50 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white"
              >
                {semesters.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Year</label>
              <input
                type="number"
                value={unpaidYear}
                onChange={(e) => setUnpaidYear(e.target.value)}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[100px] rounded-xl border border-gray-200 bg-gray-50/50 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Class</label>
              <select
                value={unpaidClassId}
                onChange={(e) => setUnpaidClassId(e.target.value)}
                className="h-10 w-full min-w-0 sm:w-auto sm:min-w-[200px] rounded-xl border border-gray-200 bg-gray-50/50 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white"
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
              onClick={handleGenerateUnpaid}
              disabled={!unpaidClassId || unpaidLoading}
            >
              {unpaidLoading ? "Loading..." : "Generate List"}
            </Button>
          </div>
        </div>

        {unpaidClassInfo && (
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {unpaidClassInfo.department.code} - {unpaidClassInfo.name} ({unpaidClassInfo.semester} {unpaidClassInfo.year})
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {unpaidStudents.length} unpaid student{unpaidStudents.length !== 1 ? "s" : ""}
                </p>
              </div>
              {unpaidStudents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportUnpaidCSV}
                >
                  Export CSV
                </Button>
              )}
            </div>

            {unpaidStudents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800/30">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  All students in this class have paid for {unpaidClassInfo.semester} {unpaidClassInfo.year}.
                </p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader>Student ID</TableCell>
                      <TableCell isHeader>Name</TableCell>
                      <TableCell isHeader>Email</TableCell>
                      <TableCell isHeader>Phone</TableCell>
                      <TableCell isHeader>Department</TableCell>
                      <TableCell isHeader>Payment</TableCell>
                      <TableCell isHeader className="text-right">Amount Due</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUnpaidStudents.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link
                            href={`/students/${encodeURIComponent(s.studentId)}`}
                            className="font-mono font-medium text-brand-600 hover:underline dark:text-brand-400"
                          >
                            {s.studentId}
                          </Link>
                        </TableCell>
                        <TableCell>{s.firstName} {s.lastName}</TableCell>
                        <TableCell>{s.email || "—"}</TableCell>
                        <TableCell>{s.phone || "—"}</TableCell>
                        <TableCell>{s.department.code} - {s.department.name}</TableCell>
                        <TableCell>{s.paymentStatus || "Fully Paid"}</TableCell>
                        <TableCell className="text-right">
                          {s.tuitionFee != null ? `$${Number(s.tuitionFee).toLocaleString()}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={unpaidPage}
                totalPages={unpaidTotalPages}
                total={unpaidTotal}
                from={unpaidFrom}
                to={unpaidTo}
                pageSize={unpaidPageSize}
                onPageChange={setUnpaidPage}
                onPageSizeChange={setUnpaidPageSize}
              />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
