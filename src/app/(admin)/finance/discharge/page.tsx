"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authFetch } from "@/lib/api";
import { semestersMatch } from "@/lib/semester-match";
import { useAuth } from "@/context/AuthContext";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

type SemesterOption = { id: number; name: string; sortOrder: number; isActive: boolean };
type DepartmentOption = { id: number; name: string; code: string };
type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  departmentId?: number;
  department: { id?: number; code: string; name?: string };
};
type SearchStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  balance: number;
};
type Candidate = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  balance: number;
  chargeAmount: number;
  chargeIds: number[];
  source: "charge" | "manual" | "both";
  suggestedReverse: number;
};
type DischargeResult = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  reversed: number;
  newBalance: number;
  chargesRemoved: number;
};

const CURRENT_YEAR = new Date().getFullYear();
const inputCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:text-white/80 dark:focus:border-brand-500/40";
const selectCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:text-white/80 dark:focus:border-brand-500/40";
const labelCls = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["items", "semesters", "classes", "departments"]) {
      if (Array.isArray(o[key])) return o[key] as T[];
    }
  }
  return [];
}

function classDepartmentId(c: ClassOption): number | null {
  const id = c.department?.id ?? c.departmentId;
  return Number.isInteger(id) && (id as number) > 0 ? (id as number) : null;
}

function fmtAmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DischargeTuitionPage() {
  const { hasPermission } = useAuth();
  const canDischarge = hasPermission("finance.charge") || hasPermission("admission.edit");

  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [mode, setMode] = useState<"class" | "students">("class");
  const [classId, setClassId] = useState("");
  const [semester, setSemester] = useState("");
  const [year, setYear] = useState(CURRENT_YEAR);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [picked, setPicked] = useState<SearchStudent[]>([]);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [loadingList, setLoadingList] = useState(false);

  const [minimizeBalance, setMinimizeBalance] = useState(true);
  const [removeCharges, setRemoveCharges] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    discharged: number;
    reversedTotal: number;
    chargesRemoved: number;
    results: DischargeResult[];
  } | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    authFetch("/api/semesters?active=true")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = asList<SemesterOption>(data).filter((s) => s.isActive !== false);
        list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
        setSemesters(list);
        setSemester((prev) => prev || list[0]?.name || "");
      })
      .catch(() => {});
    authFetch("/api/departments")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = asList<DepartmentOption>(data);
        list.sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(list);
      })
      .catch(() => {});
    authFetch("/api/classes?active=true")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setClassOptions(asList<ClassOption>(data)))
      .catch(() => {});
  }, []);

  const classesForDepartment = useMemo(() => {
    if (!departmentId) return [];
    const did = Number(departmentId);
    return classOptions.filter((c) => classDepartmentId(c) === did);
  }, [classOptions, departmentId]);

  useEffect(() => {
    if (mode !== "class") return;
    const cls = classOptions.find((c) => String(c.id) === classId);
    if (!cls) return;
    const match = semesters.find((s) => semestersMatch(s.name, cls.semester));
    setSemester(match?.name ?? cls.semester);
    setYear(cls.year);
  }, [mode, classId, classOptions, semesters]);

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
        const res = await authFetch(`/api/students/search?q=${encodeURIComponent(q)}&limit=20`);
        if (res.ok) setSearchResults(await res.json());
        else setSearchResults([]);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 280);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const loadCandidates = useCallback(async () => {
    if (!semester || !Number.isInteger(year)) return;
    setLoadingList(true);
    setError("");
    setResult(null);
    try {
      const params = new URLSearchParams({ semester, year: String(year) });
      if (mode === "class") {
        if (!classId) {
          setCandidates([]);
          setSelectedIds(new Set());
          return;
        }
        params.set("classId", classId);
      } else {
        if (picked.length === 0) {
          setCandidates([]);
          setSelectedIds(new Set());
          return;
        }
        params.set("studentIds", picked.map((s) => s.id).join(","));
      }
      const res = await authFetch(`/api/students/bulk-tuition-discharge?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not load charged students.");
        setCandidates([]);
        return;
      }
      const rows: Candidate[] = Array.isArray(data?.students) ? data.students : [];
      setCandidates(rows);
      setSelectedIds(new Set(rows.map((r) => r.id)));
      setAmounts(Object.fromEntries(rows.map((r) => [r.id, String(r.suggestedReverse)])));
    } catch {
      setError("Could not load charged students.");
      setCandidates([]);
    } finally {
      setLoadingList(false);
    }
  }, [mode, classId, semester, year, picked]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const toggleAll = (on: boolean) => {
    setSelectedIds(on ? new Set(candidates.map((c) => c.id)) : new Set());
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selected = candidates.filter((c) => selectedIds.has(c.id));
  const reversePreview = selected.reduce((s, c) => {
    const n = parseFloat(amounts[c.id] ?? "");
    return s + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  const chargeCount = selected.reduce((s, c) => s + c.chargeIds.length, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDischarge || selected.length === 0) return;
    if (!minimizeBalance && !removeCharges) {
      setError("Select Minimize the balance and/or Remove the charged students.");
      return;
    }
    const ok = window.confirm(
      [
        `Discharge ${selected.length} student(s) for ${semester} ${year}?`,
        minimizeBalance ? `Reduce balances by about $${fmtAmt(reversePreview)}.` : null,
        removeCharges ? `Delete ${chargeCount} charge record(s).` : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
    if (!ok) return;

    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const bodyAmounts: Record<string, number> = {};
      for (const c of selected) {
        const n = parseFloat(amounts[c.id] ?? "");
        bodyAmounts[String(c.id)] = Number.isFinite(n) && n >= 0 ? n : 0;
      }
      const res = await authFetch("/api/students/bulk-tuition-discharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selected.map((c) => c.id),
          semester,
          year,
          minimizeBalance,
          removeCharges,
          amounts: bodyAmounts,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Discharge failed.");
        return;
      }
      setResult(data);
      await loadCandidates();
    } catch {
      setError("Discharge failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasPermission("finance.view") && !canDischarge) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Discharge Tuition" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">You do not have permission to discharge tuition.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Discharge Tuition" />

      <div className="mx-auto max-w-5xl min-w-0">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400">
                <FileText className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  Discharge Tuition
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Reverse a wrong class charge or a manual balance. Reduce the balance, remove charge records, or both.
                </p>
              </div>
            </div>
            <Link
              href="/finance/charges"
              className="text-sm text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
            >
              Charge history →
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-6">
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-500/10 dark:text-error-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {result && (
              <div className="mb-5 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800 dark:border-success-800 dark:bg-success-500/10 dark:text-success-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    Discharged {result.discharged} student(s). Reduced balances by ${fmtAmt(result.reversedTotal)}.
                    Removed {result.chargesRemoved} charge record(s).
                  </div>
                </div>
              </div>
            )}

            <div className="mb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("class");
                  setPicked([]);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === "class"
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
                }`}
              >
                <Users className="h-4 w-4" />
                Wrong class
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("students");
                  setClassId("");
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === "students"
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
                }`}
              >
                <UserRound className="h-4 w-4" />
                Selected students
              </button>
            </div>

            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              {mode === "class" ? (
                <>
                  <div>
                    <label className={labelCls}>Department</label>
                    <select
                      value={departmentId}
                      onChange={(e) => {
                        setDepartmentId(e.target.value);
                        setClassId("");
                      }}
                      className={selectCls}
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.code} — {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Class that was charged</label>
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className={selectCls}
                      disabled={!departmentId}
                    >
                      <option value="">{departmentId ? "Select class" : "Choose a department first"}</option>
                      {classesForDepartment.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name} · {c.semester} {c.year}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className={labelCls}>Find students charged by hand</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Student ID or name"
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  {searchLoading && (
                    <p className="mt-2 text-xs text-gray-500">Searching…</p>
                  )}
                  {searchResults.length > 0 && (
                    <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      {searchResults.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5"
                            onClick={() => {
                              setPicked((prev) => (prev.some((p) => p.id === s.id) ? prev : [...prev, s]));
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                          >
                            <span>
                              {s.firstName} {s.lastName}{" "}
                              <span className="font-mono text-xs text-gray-500">{s.studentId}</span>
                            </span>
                            <span className="tabular-nums text-gray-500">${fmtAmt(s.balance)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {picked.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {picked.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs dark:bg-white/10"
                        >
                          {s.studentId}
                          <button
                            type="button"
                            onClick={() => setPicked((prev) => prev.filter((p) => p.id !== s.id))}
                            aria-label={`Remove ${s.studentId}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={labelCls}>Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className={selectCls}
                  disabled={mode === "class"}
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Year</label>
                <select
                  value={String(year)}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className={selectCls}
                  disabled={mode === "class"}
                >
                  {Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i).map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-5 space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">What to reverse</p>
              <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  checked={minimizeBalance}
                  onChange={(e) => setMinimizeBalance(e.target.checked)}
                />
                <span>
                  <strong>Minimize the balance</strong>
                  <span className="block text-xs text-gray-500">
                    Subtract the reverse amount from each selected student’s current balance (never below zero). Use this for charges posted as invoices and for balances entered by hand.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  checked={removeCharges}
                  onChange={(e) => setRemoveCharges(e.target.checked)}
                />
                <span>
                  <strong>Remove the charged students</strong>
                  <span className="block text-xs text-gray-500">
                    Delete the tuition charge records for this term so they can be charged on the correct class later.
                  </span>
                </span>
              </label>
            </div>

            <div className="mb-5 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              {loadingList ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading charged students…
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  {mode === "class" && !classId
                    ? "Select the class that was charged incorrectly."
                    : mode === "students" && picked.length === 0
                      ? "Search and add students whose balances were entered by hand."
                      : "No charge records or positive balances found for this term."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader>
                        <input
                          type="checkbox"
                          checked={selectedIds.size === candidates.length && candidates.length > 0}
                          onChange={(e) => toggleAll(e.target.checked)}
                          aria-label="Select all"
                        />
                      </TableCell>
                      <TableCell isHeader>Student</TableCell>
                      <TableCell isHeader>Source</TableCell>
                      <TableCell isHeader className="text-right">Charged</TableCell>
                      <TableCell isHeader className="text-right">Balance</TableCell>
                      <TableCell isHeader className="text-right">Reverse amount</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleOne(c.id)}
                            aria-label={`Select ${c.studentId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-gray-800 dark:text-white/90">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="font-mono text-xs text-gray-500">{c.studentId}</p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            color={c.source === "manual" ? "warning" : "info"}
                            size="sm"
                          >
                            {c.source === "manual" ? "Manual balance" : c.source === "both" ? "Charge + balance" : "Charged"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">${fmtAmt(c.chargeAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">${fmtAmt(c.balance)}</TableCell>
                        <TableCell className="text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={amounts[c.id] ?? ""}
                            onChange={(e) =>
                              setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                            className={`${inputCls} ml-auto w-28 text-right`}
                            disabled={!minimizeBalance}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selected.length} selected
                {minimizeBalance ? ` · about $${fmtAmt(reversePreview)} off balances` : ""}
                {removeCharges ? ` · ${chargeCount} charge record(s)` : ""}
              </p>
              <Button
                type="submit"
                disabled={!canDischarge || submitting || selected.length === 0 || (!minimizeBalance && !removeCharges)}
              >
                {submitting ? "Discharging…" : "Discharge selected"}
              </Button>
            </div>
            {!canDischarge && (
              <p className="mt-3 text-xs text-gray-500">You can view this list but need charge permission to discharge.</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
