"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { DateInput } from "@/components/form/DateInput";
import { authFetch } from "@/lib/api";
import { perSemesterTuition, semesterAmountPaid } from "@/lib/tuition-amount";
import { FINANCE_HEADS, financeHeadLabel, paymentIncludesSemesterFee, type FinanceHead } from "@/lib/finance-head";
import { useAuth } from "@/context/AuthContext";
import { useFormDraft } from "@/hooks/useFormDraft";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  Info,
  Search,
  Plus,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";

type Bank = { id: number; name: string; code: string; balance: number; accountNumber?: string | null };
type PaymentMethod = {
  id: number;
  name: string;
  description: string | null;
  bank: { id: number; name: string; code: string } | null;
};
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
  customSemesterFee: number | null;
  department: { name: string; code: string; tuitionFee: number | null };
  class: { name: string; semester: string; year: number; department: { code: string } } | null;
  tuitionPayments: { semester: string; year: number; amount: number }[];
};

const CURRENT_YEAR = new Date().getFullYear();

type HeadRow = { id: string; financeHead: FinanceHead | ""; amount: string };

type TuitionDraft = {
  searchQuery: string;
  selectedStudentId: string;
  payHeadRows: HeadRow[];
  payMethodId: string;
  payBankId: string;
  paySemester: string;
  payYear: string;
  receiptNumber: string;
  paymentDate: string;
  payNote: string;
};

const tuitionDraftInitial: TuitionDraft = {
  searchQuery: "",
  selectedStudentId: "",
  payHeadRows: [],
  payMethodId: "",
  payBankId: "",
  paySemester: "",
  payYear: String(CURRENT_YEAR),
  receiptNumber: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  payNote: "",
};

function newHeadRow(): HeadRow {
  return { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, financeHead: "", amount: "" };
}

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);

  const {
    values: draft,
    setField: setDraftField,
    setAll: setDraftAll,
    clearDraft,
    discardDraft,
    hasDraft,
  } = useFormDraft<TuitionDraft>("tuition-payment-v3", tuitionDraftInitial);

  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SearchStudent | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const [paySuccess, setPaySuccess] = useState(false);
  const [paySuccessCount, setPaySuccessCount] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchQuery = draft.searchQuery;
  const payHeadRows = draft.payHeadRows ?? [];
  const payMethodId = draft.payMethodId;
  const payBankId = draft.payBankId;
  const paySemester = draft.paySemester;
  const payYear = draft.payYear;
  const receiptNumber = draft.receiptNumber;
  const paymentDate = draft.paymentDate;
  const payNote = draft.payNote;

  const setSearchQuery = (v: string) => setDraftField("searchQuery", v);
  const setPayMethodId = (v: string) => setDraftField("payMethodId", v);
  const setPayBankId = (v: string) => setDraftField("payBankId", v);
  const setPaySemester = (v: string) => setDraftField("paySemester", v);
  const setPayYear = (v: string) => setDraftField("payYear", v);
  const setReceiptNumber = (v: string) => setDraftField("receiptNumber", v);
  const setPaymentDate = (v: string) => setDraftField("paymentDate", v);
  const setPayNote = (v: string) => setDraftField("payNote", v);

  const addHeadRow = () => {
    setDraftAll((prev) => ({
      ...prev,
      payHeadRows: [...(prev.payHeadRows ?? []), newHeadRow()],
    }));
  };

  const removeHeadRow = (id: string) => {
    setDraftAll((prev) => ({
      ...prev,
      payHeadRows: (prev.payHeadRows ?? []).filter((r) => r.id !== id),
    }));
  };

  const updateHeadRow = (id: string, patch: Partial<Pick<HeadRow, "financeHead" | "amount">>) => {
    setDraftAll((prev) => ({
      ...prev,
      payHeadRows: (prev.payHeadRows ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const canRecordPayment = hasPermission("finance.create") || hasPermission("finance.view");

  useEffect(() => {
    authFetch("/api/banks").then((r) => {
      if (r.ok) r.json().then((d: Bank[]) => {
        setBanks(d);
        if (d.length > 0 && !payBankId) setPayBankId(String(d[0].id));
      });
    });
    authFetch("/api/payment-methods").then((r) => {
      if (r.ok) r.json().then((d: PaymentMethod[]) => setMethods(Array.isArray(d) ? d : []));
    });
    authFetch("/api/semesters?active=true").then((r) => {
      if (r.ok) r.json().then((d: SemesterOption[]) => {
        setSemesters(d);
        if (d.length > 0 && !paySemester) setPaySemester(d[0].name);
      });
    });
  }, []);

  // Default: first payment method, else first bank. Keep linked bank when a method is selected.
  useEffect(() => {
    if (payMethodId) {
      const current = methods.find((m) => String(m.id) === payMethodId);
      if (current?.bank && payBankId !== String(current.bank.id)) {
        setPayBankId(String(current.bank.id));
      }
      return;
    }
    if (payBankId) return;
    if (methods.length > 0) {
      const first = methods[0];
      setPayMethodId(String(first.id));
      if (first.bank) setPayBankId(String(first.bank.id));
    } else if (banks.length > 0) {
      setPayBankId(String(banks[0].id));
    }
  }, [methods, banks, payMethodId, payBankId]);

  useEffect(() => {
    if (semesters.length > 0 && !paySemester) setPaySemester(semesters[0].name);
  }, [semesters, paySemester]);

  useEffect(() => {
    if (!draft.selectedStudentId) return;
    void (async () => {
      const res = await authFetch(
        `/api/students/search?q=${encodeURIComponent(draft.selectedStudentId)}&limit=5`
      );
      if (res.ok) {
        const results: SearchStudent[] = await res.json();
        const match = results.find((s) => s.studentId === draft.selectedStudentId);
        if (match) setSelectedStudent(match);
      }
    })();
  }, [draft.selectedStudentId]);

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

  const expectedFull = selectedStudent
    ? perSemesterTuition(
        selectedStudent.department?.tuitionFee ?? 0,
        selectedStudent.paymentStatus,
        selectedStudent.customSemesterFee
      )
    : 0;
  const semesterPayments =
    selectedStudent?.tuitionPayments.filter(
      (p) => p.semester === paySemester && p.year === Number(payYear)
    ) ?? [];
  const semesterPaid = semesterAmountPaid(semesterPayments);
  const remainingForSemester = Math.max(0, expectedFull - semesterPaid);

  const usedHeads = new Set(
    payHeadRows.map((r) => r.financeHead).filter((h): h is FinanceHead => Boolean(h))
  );

  const activeLines = payHeadRows
    .filter((r) => r.financeHead && Number(r.amount) > 0)
    .map((r) => ({
      financeHead: r.financeHead as FinanceHead,
      label: financeHeadLabel(r.financeHead),
      amount: Number(r.amount),
    }));
  const totalAmount = activeLines.reduce((sum, l) => sum + l.amount, 0);
  const includesSemesterFee = paymentIncludesSemesterFee(activeLines);

  const applySemesterQuickAmount = (rowId: string, mode: "full" | "half") => {
    const base = remainingForSemester > 0 ? remainingForSemester : expectedFull;
    const amt = mode === "half" ? base * 0.5 : base;
    updateHeadRow(rowId, { financeHead: "semester_fee", amount: String(amt) });
  };

  useEffect(() => {
    setPayError("");
  }, [selectedStudent, paySemester, payYear, payHeadRows]);

  const handleSelectStudent = (s: SearchStudent) => {
    setSelectedStudent(s);
    setSearchResults([]);
    setDraftAll((prev) => ({
      ...prev,
      selectedStudentId: s.studentId,
      searchQuery: `${s.firstName} ${s.lastName} (${s.studentId})`,
      ...(s.class?.semester ? { paySemester: s.class.semester } : {}),
      ...(s.class?.year != null ? { payYear: String(s.class.year) } : {}),
    }));
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setDraftAll((prev) => ({ ...prev, selectedStudentId: "", searchQuery: "" }));
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError("");
    setPaySuccess(false);
    if (!selectedStudent) {
      setPayError("Please select a student");
      return;
    }
    if (!payMethodId && !payBankId) {
      setPayError("Select a payment method or a bank account");
      return;
    }
    if (activeLines.length === 0) {
      const incomplete = payHeadRows.find((r) => (r.financeHead && !(Number(r.amount) > 0)) || (!r.financeHead && r.amount.trim()));
      setPayError(
        incomplete
          ? incomplete.financeHead
            ? `Enter an amount for ${financeHeadLabel(incomplete.financeHead)}`
            : "Select a finance head for each amount entered"
          : payHeadRows.length === 0
            ? "Add at least one finance head and amount"
            : "Enter an amount for each finance head"
      );
      return;
    }
    if (includesSemesterFee && !paySemester.trim()) {
      setPayError("Semester is required when recording Semester Fee");
      return;
    }
    if (includesSemesterFee && !payYear.trim()) {
      setPayError("Year is required when recording Semester Fee");
      return;
    }
    if (!receiptNumber.trim()) {
      setPayError("Receipt or reference number is required");
      return;
    }
    setPaySubmitting(true);
    try {
      for (const line of activeLines) {
        const res = await authFetch("/api/tuition-payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: selectedStudent.studentId,
            semester: paySemester.trim() || undefined,
            year: payYear.trim() ? Number(payYear) : undefined,
            amount: line.amount,
            financeHead: line.financeHead,
            paymentMethodId: payMethodId ? Number(payMethodId) : undefined,
            bankId: payBankId ? Number(payBankId) : undefined,
            paymentMethod: "bank_receipt",
            receiptNumber: receiptNumber.trim(),
            paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
            note: payNote || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPayError(
            `${line.label}: ${data.error || "Payment failed"}`
          );
          return;
        }
      }
      setPaySuccessCount(activeLines.length);
      setPaySuccess(true);
      handleClearStudent();
      clearDraft();
      setDraftAll({
        ...tuitionDraftInitial,
        payMethodId,
        payBankId,
        paySemester,
      });
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
    "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500 dark:focus:ring-brand-500/20";
  const selectClass =
    "h-9 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:focus:border-brand-500 dark:focus:ring-brand-500/20";
  const tableInputClass =
    "h-8 w-full min-w-0 rounded-md border border-gray-200 bg-white px-2 text-sm tabular-nums text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

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
            href="/finance/payment-methods"
            className="text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white"
          >
            Payment methods
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <Link
            href="/reports/finance-heads"
            className="text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white"
          >
            Finance heads
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

      <div className="mx-auto min-w-0 max-w-2xl">
        {hasDraft && !paySuccess && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 opacity-80" />
              Draft restored — your previous entries were saved locally.
            </span>
            <button
              type="button"
              onClick={discardDraft}
              className="text-xs font-medium underline underline-offset-2"
            >
              Discard draft
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <form onSubmit={handleRecordPayment} className="divide-y divide-gray-100 dark:divide-gray-800">
            <div className="p-4">
              {payError && (
                <div
                  role="alert"
                  className="mb-6 flex gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                  <span>{payError}</span>
                </div>
              )}
              {paySuccess && (
                <div className="mb-6 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                  <div>
                    <p className="font-medium">
                      Saved {paySuccessCount > 1 ? `${paySuccessCount} payments` : "payment"} — student
                      and bank balances are updated.
                    </p>
                    <Link
                      href="/finance/payments"
                      className="mt-1 inline-block text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                    >
                      Open payment history
                    </Link>
                  </div>
                </div>
              )}

              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <User className="h-4 w-4 text-gray-500" strokeWidth={2} />
                Student
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Search by name, ID, or phone (2+ characters).</p>
              <div className="relative mt-3">
                <label className="sr-only">Find student</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!e.target.value) {
                        setSelectedStudent(null);
                        setDraftField("selectedStudentId", "");
                      }
                    }}
                    placeholder="Name, STD-…, or phone"
                    className={`${inputClass} pl-10 pr-11`}
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
                  <Button type="button" variant="outline" size="sm" onClick={handleClearStudent} startIcon={<X className="h-3.5 w-3.5" />}>
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <div className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Wallet className="h-4 w-4 text-gray-500" strokeWidth={2} />
                Term
                {!includesSemesterFee && (
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(optional)</span>
                )}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                    Semester{includesSemesterFee ? " *" : ""}
                  </label>
                  <select value={paySemester} onChange={(e) => setPaySemester(e.target.value)} className={selectClass}>
                    <option value="">—</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                    Year{includesSemesterFee ? " *" : ""}
                  </label>
                  <input
                    type="number"
                    value={payYear}
                    onChange={(e) => setPayYear(e.target.value)}
                    className={inputClass}
                    placeholder={String(CURRENT_YEAR)}
                  />
                </div>
                <DateInput
                  id="finance-payment-date"
                  label={<span className="text-xs text-gray-600 dark:text-gray-400">Payment date</span>}
                  labelClassName="mb-1 block"
                  value={paymentDate}
                  onChange={setPaymentDate}
                  inputClassName={inputClass}
                />
              </div>
            </div>

            <div className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <CreditCard className="h-4 w-4 text-gray-500" strokeWidth={2} />
                Collect via
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Choose either a payment method or a bank account — not both.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                    Payment method
                  </label>
                  <select
                    value={payMethodId}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        setPayMethodId("");
                        return;
                      }
                      setPayMethodId(id);
                      const m = methods.find((x) => String(x.id) === id);
                      if (m?.bank) setPayBankId(String(m.bank.id));
                    }}
                    className={selectClass}
                  >
                    <option value="">— None —</option>
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.bank ? ` (${m.bank.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                    Bank account
                  </label>
                  <select
                    value={payMethodId ? "" : payBankId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPayMethodId("");
                      setPayBankId(id);
                    }}
                    className={selectClass}
                  >
                    <option value="">— None —</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {methods.length === 0 && banks.length === 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  No banks or{" "}
                  <Link href="/finance/payment-methods" className="text-brand-600 hover:underline dark:text-brand-400">
                    payment methods
                  </Link>{" "}
                  configured yet.
                </p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                    Receipt / reference # <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder="Slip or transfer reference"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Staff note</label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Banknote className="h-4 w-4 text-gray-500" strokeWidth={2} />
                  Finance heads &amp; amounts
                </h2>
                <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                  ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>

              {selectedStudent &&
                payHeadRows.some((r) => r.financeHead === "semester_fee") &&
                semesterPaid > 0 &&
                remainingForSemester > 0 && (
                  <div className="mb-3 flex gap-2 rounded-md border border-blue-200/90 bg-blue-50 px-2.5 py-2 text-xs text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/25 dark:text-blue-100">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Remaining tuition for {paySemester} {payYear}: ${remainingForSemester.toLocaleString()}
                    </span>
                  </div>
                )}

              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-white/5 dark:text-gray-400">
                      <th className="px-2 py-2">Finance head</th>
                      <th className="px-2 py-2 w-28">Amount</th>
                      <th className="w-8 px-1 py-2" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {payHeadRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                          No lines yet. Click Add new to record a fee.
                        </td>
                      </tr>
                    ) : (
                      payHeadRows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                          <td className="px-2 py-1.5">
                            <select
                              value={row.financeHead}
                              onChange={(e) =>
                                updateHeadRow(row.id, {
                                  financeHead: e.target.value as FinanceHead | "",
                                })
                              }
                              className={tableInputClass}
                            >
                              <option value="">Select head</option>
                              {FINANCE_HEADS.map((h) => (
                                <option
                                  key={h.value}
                                  value={h.value}
                                  disabled={usedHeads.has(h.value) && row.financeHead !== h.value}
                                >
                                  {h.label}
                                </option>
                              ))}
                            </select>
                            {row.financeHead === "semester_fee" && selectedStudent && (
                              <div className="mt-1 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => applySemesterQuickAmount(row.id, "full")}
                                  className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                                >
                                  {remainingForSemester > 0 && semesterPaid > 0 ? "Rem." : "Full"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applySemesterQuickAmount(row.id, "half")}
                                  className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                                >
                                  Half
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.amount}
                              onChange={(e) => updateHeadRow(row.id, { amount: e.target.value })}
                              placeholder="0.00"
                              className={tableInputClass}
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeHeadRow(row.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                              aria-label="Remove row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                startIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={addHeadRow}
                disabled={payHeadRows.length >= FINANCE_HEADS.length}
              >
                Add new
              </Button>

              <div className="mt-4 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                {!canRecordPayment ? (
                  <p className="text-center text-xs text-gray-500 sm:mr-auto sm:text-left dark:text-gray-400">
                    Needs <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">finance.create</code> to submit.
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={
                    !selectedStudent ||
                    activeLines.length === 0 ||
                    (!payMethodId && !payBankId) ||
                    paySubmitting ||
                    !canRecordPayment
                  }
                  className="rounded-lg px-6 py-2 text-sm font-semibold sm:min-w-36"
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
