"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { DateInput } from "@/components/form/DateInput";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  DollarLineIcon,
  UserCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  CalenderIcon,
  AlertIcon,
} from "@/icons";

type Bank = { id: number; name: string; code: string; balance: number; accountNumber?: string | null };
type SemesterOption = { id: number; name: string; sortOrder: number; isActive: boolean };
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

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);

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
      });
    });
  }, []);

  useEffect(() => {
    if (banks.length > 0 && !payBankId) setPayBankId(String(banks[0].id));
  }, [banks, payBankId]);

  useEffect(() => {
    if (semesters.length > 0 && !paySemester) setPaySemester(semesters[0].name);
  }, [semesters, paySemester]);

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
      authFetch("/api/banks").then((r) => { if (r.ok) r.json().then(setBanks); });
    } catch {
      setPayError("Network error");
    } finally {
      setPaySubmitting(false);
    }
  };

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

      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/finance/payments" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Payments
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
        <Link href="/reports/payment" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Finance reports
        </Link>
      </div>

      <div className="mx-auto max-w-3xl min-w-0">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/3">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <DollarLineIcon className="h-5 w-5 shrink-0 text-brand-500" />
              Payment form
            </h2>
          </div>

        <form onSubmit={handleRecordPayment} className="p-5 sm:p-6">
          <div className="space-y-8">
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
                  <p className="mt-2">
                    <Link
                      href="/finance/payments"
                      className="font-medium text-emerald-800 underline decoration-emerald-600/50 underline-offset-2 hover:text-emerald-900 dark:text-emerald-200 dark:decoration-emerald-400/50"
                    >
                      View payment history
                    </Link>
                  </p>
                </div>
              </div>
            )}

            <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
              <div className="mb-4">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">Student</h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Type at least two characters to search by name, phone, or student ID.
                </p>
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

            <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
              <div className="mb-4">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">Period &amp; bank</h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Semester, year, and the account this deposit is credited to.
                </p>
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

            <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
              <div className="mb-4">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">Amount &amp; method</h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Tuition amount and how the payment was received.
                </p>
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
      </div>
    </div>
  );
}
