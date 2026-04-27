"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { DateInput } from "@/components/form/DateInput";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CheckCircleIcon, InfoIcon, AlertIcon } from "@/icons";

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

      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">Finance</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Record tuition payment
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-400">
            Post a deposit against a student&apos;s balance and credit the right bank account.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link
            href="/finance/payments"
            className="text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white"
          >
            History
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <Link
            href="/finance/banks"
            className="text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white"
          >
            Banks
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <Link
            href="/reports/payment"
            className="text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white"
          >
            Reports
          </Link>
        </nav>
      </div>

      <div className="mx-auto min-w-0 max-w-3xl">
        <div className="overflow-hidden rounded-xl border border-gray-200/90 bg-white dark:border-gray-800 dark:bg-gray-950">
          <form onSubmit={handleRecordPayment} className="divide-y divide-gray-100 dark:divide-gray-800">
            <div className="p-5 sm:p-6">
              {payError && (
                <div
                  role="alert"
                  className="mb-6 flex gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                >
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                  <span>{payError}</span>
                </div>
              )}
              {paySuccess && (
                <div className="mb-6 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                  <div>
                    <p className="font-medium">Saved — student and bank balances are updated.</p>
                    <Link
                      href="/finance/payments"
                      className="mt-1 inline-block text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                    >
                      Open payment history
                    </Link>
                  </div>
                </div>
              )}

              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Student</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Search by name, ID, or phone (2+ characters).</p>
              <div className="relative mt-3">
                <label className="sr-only">Find student</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!e.target.value) setSelectedStudent(null);
                    }}
                    placeholder="Name, STD-…, or phone"
                    className={`${inputClass} pr-11`}
                    autoComplete="off"
                  />
                  {searchLoading && (
                    <div className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300" />
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    {searchResults.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectStudent(s)}
                        className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {s.firstName} {s.lastName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {s.studentId} · {s.department?.code} · owed ${(s.balance ?? 0).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedStudent && (
                <div className="mt-4 flex flex-col gap-3 border-l-2 border-brand-500 bg-gray-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-white/3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-200/90 text-sm font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                      aria-hidden
                    >
                      {studentInitials}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedStudent.firstName} {selectedStudent.lastName}
                      </p>
                      <p className="font-mono text-xs text-gray-600 dark:text-gray-400">{selectedStudent.studentId}</p>
                      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                        {selectedStudent.department?.name} · Balance{" "}
                        <span className="tabular-nums text-gray-900 dark:text-gray-200">
                          ${(selectedStudent.balance ?? 0).toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleClearStudent}>
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Term &amp; deposit</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">
                    Bank account <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={payBankId}
                    onChange={(e) => setPayBankId(e.target.value)}
                    required
                    className={selectClass}
                  >
                    <option value="">Select account…</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    Where this deposit landed (include petty cash if you use it as a bank).
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">Semester</label>
                    <select value={paySemester} onChange={(e) => setPaySemester(e.target.value)} className={selectClass}>
                      {semesters.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">Year</label>
                    <input
                      type="number"
                      value={payYear}
                      onChange={(e) => setPayYear(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <DateInput
                    id="finance-payment-date"
                    label={<span className="text-sm text-gray-700 dark:text-gray-300">Payment date</span>}
                    labelClassName="mb-1.5 block"
                    value={paymentDate}
                    onChange={setPaymentDate}
                    inputClassName={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Amount</h2>
                <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  ${Number(computedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </p>
              </div>

              {selectedStudent && expectedFull === 0 && (
                <div className="mt-3 flex gap-2 rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
                  <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Scheduled fee is $0 (e.g. scholarship). Double-check the amount before saving.</span>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {[
                  { value: "full" as const, label: "Full", hint: `$${expectedFull.toLocaleString()}` },
                  { value: "half" as const, label: "Half", hint: `$${(expectedFull * 0.5).toLocaleString()}` },
                  { value: "custom" as const, label: "Other", hint: null },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      payAmountType === opt.value
                        ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                        : "border-gray-200 bg-white text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="amountType"
                      checked={payAmountType === opt.value}
                      onChange={() => setPayAmountType(opt.value)}
                      className="sr-only"
                    />
                    <span className="font-medium">{opt.label}</span>
                    {opt.hint ? <span className="tabular-nums opacity-70">{opt.hint}</span> : null}
                  </label>
                ))}
                {payAmountType === "custom" && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Amount"
                    className="h-11 w-36 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                )}
              </div>

              <div className="mt-8">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">How it was paid</h2>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {[
                    { value: "bank_receipt" as const, label: "Bank receipt" },
                    { value: "electronic" as const, label: "Transfer / mobile money" },
                    { value: "cash_on_hand" as const, label: "Cash" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm font-medium sm:min-w-30 sm:flex-initial ${
                        paymentMethod === opt.value
                          ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                          : "border-gray-200 text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === opt.value}
                        onChange={() => setPaymentMethod(opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                {paymentMethod === "bank_receipt" ? (
                  <div>
                    <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">
                      Receipt # <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      placeholder="Number on the slip"
                      className={inputClass}
                    />
                  </div>
                ) : paymentMethod === "electronic" ? (
                  <div>
                    <label className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">
                      Reference / transaction ID <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="From bank SMS or statement"
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">Cash — no reference required. Use the note field if you want one on file.</p>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">Staff note</label>
              <p className="text-xs text-gray-500 dark:text-gray-500">Optional. Not shown to students.</p>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="e.g. Paid by guardian"
                className={`${inputClass} mt-2`}
              />
              <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                {!canRecordPayment ? (
                  <p className="text-center text-xs text-gray-500 sm:mr-auto sm:text-left dark:text-gray-400">
                    Needs <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">finance.create</code> to submit.
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={!selectedStudent || !payBankId || paySubmitting || !canRecordPayment}
                  className="rounded-lg px-8 py-2.5 text-sm font-semibold sm:min-w-44"
                >
                  {paySubmitting ? "Saving…" : "Record payment"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
