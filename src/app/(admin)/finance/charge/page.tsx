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
import { buildTermSequence } from "@/lib/semester-term-sequence";
import { perSemesterTuition } from "@/lib/tuition-amount";
import { semestersMatch } from "@/lib/semester-match";
import { useAuth } from "@/context/AuthContext";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Loader2,
  Search,
  SkipForward,
  User,
  UserRound,
  Users,
  X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type SemesterOption = { id: number; name: string; sortOrder: number; isActive: boolean };
type DepartmentOption = { id: number; name: string; code: string };
type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  departmentId?: number;
  department: { id?: number; code: string; name?: string };
  activeStudentCount?: number;
};
type SearchStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  balance: number;
  paymentStatus: string;
  customSemesterFee: number | null;
  department: { name: string; code: string; tuitionFee: number | null };
  class: { name: string; semester: string; year: number } | null;
};

type ChargeMode = "class" | "student" | "students";

type ChargeResult = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  perSemester: number;
  charge: number;
  newBalance: number;
  periodsCharged?: { semester: string; year: number }[];
  periodsSkipped?: number;
};
type SkipDetail = { id: number; reason: string };

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChargeTuitionPage() {
  const { hasPermission } = useAuth();
  const canCharge = hasPermission("finance.charge") || hasPermission("admission.edit");

  // -- semester, department & class options
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [departmentId, setDepartmentId] = useState("");

  // -- form state
  const [mode, setMode] = useState<ChargeMode>("class");
  const [classId, setClassId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SearchStudent | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<SearchStudent[]>([]);
  const [semesterCount, setSemesterCount] = useState(1);
  const [startSemester, setStartSemester] = useState("");
  const [startYear, setStartYear] = useState(CURRENT_YEAR);
  const [note, setNote] = useState("");
  // per-student per-semester overrides
  const [perSemesterInputs, setPerSemesterInputs] = useState<Record<number, string>>({});

  // -- submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    charged: number;
    skipped: number;
    results: ChargeResult[];
    skippedDetails?: SkipDetail[];
  } | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load semesters & departments on mount ────────────────────────────────
  useEffect(() => {
    authFetch("/api/semesters?active=true")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = asList<SemesterOption>(data).filter((s) => s.isActive !== false);
        list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
        setSemesters(list);
        setStartSemester((prev) => prev || list[0]?.name || "");
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
  }, []);

  // ── Load classes (full list, then filter by department in the UI) ─────────
  const loadClasses = useCallback(async () => {
    setClassesLoading(true);
    try {
      const res = await authFetch("/api/classes?active=true");
      if (!res.ok) return;
      setClassOptions(asList<ClassOption>(await res.json()));
    } catch {
      /* noop */
    } finally {
      setClassesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const classesForDepartment = useMemo(() => {
    if (!departmentId) return [];
    const did = Number(departmentId);
    return classOptions.filter((c) => classDepartmentId(c) === did);
  }, [classOptions, departmentId]);

  const handleDepartmentChange = (id: string) => {
    setDepartmentId(id);
    setClassId("");
  };

  // Class mode always invoices the class's own semester/year (one term).
  useEffect(() => {
    if (mode !== "class") return;
    const cls = classOptions.find((c) => String(c.id) === classId);
    if (!cls) return;
    const match = semesters.find((s) => semestersMatch(s.name, cls.semester));
    setStartSemester(match?.name ?? cls.semester);
    setStartYear(cls.year);
    setSemesterCount(1);
  }, [mode, classId, classOptions, semesters]);

  // ── Student search debounce ───────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await authFetch(`/api/students/search?q=${encodeURIComponent(q)}&limit=20`);
        if (res.ok) setSearchResults(await res.json());
        else setSearchResults([]);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 280);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  // ── Preview periods ───────────────────────────────────────────────────────
  const previewPeriods = useMemo(() => {
    if (!startSemester) return [];
    const names = semesters.map((s) => s.name);
    const resolved =
      names.find((n) => n === startSemester) ??
      names.find((n) => semestersMatch(n, startSemester)) ??
      startSemester;
    const count = mode === "class" ? 1 : semesterCount;
    if (names.includes(resolved)) {
      try {
        return buildTermSequence(names, resolved, startYear, count);
      } catch {
        return [{ semester: resolved, year: startYear }];
      }
    }
    return [{ semester: resolved, year: startYear }];
  }, [startSemester, startYear, semesterCount, semesters, mode]);

  // ── Effective per-semester for a student ─────────────────────────────────
  const effectivePer = useCallback((s: SearchStudent): number => {
    const override = perSemesterInputs[s.id];
    if (override !== undefined && override !== "") {
      const n = parseFloat(override);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return perSemesterTuition(s.department.tuitionFee ?? 0, s.paymentStatus, s.customSemesterFee);
  }, [perSemesterInputs]);

  // ── The students being displayed in the preview table ───────────────────
  const previewStudents: SearchStudent[] = useMemo(() => {
    if (mode === "class") return []; // class mode: no per-student preview before submit
    if (mode === "student") return selectedStudent ? [selectedStudent] : [];
    return selectedStudents;
  }, [mode, selectedStudent, selectedStudents]);

  // ── Grand total for preview ───────────────────────────────────────────────
  const previewTotal = useMemo(
    () => previewStudents.reduce((sum, s) => sum + effectivePer(s) * previewPeriods.length, 0),
    [previewStudents, effectivePer, previewPeriods]
  );

  // ── Mode switch helpers ───────────────────────────────────────────────────
  const switchMode = (m: ChargeMode) => {
    setMode(m);
    setError("");
    setResult(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedStudent(null);
    setSelectedStudents([]);
    setPerSemesterInputs({});
  };

  const handleSelectStudent = (s: SearchStudent) => {
    if (mode === "students") {
      setSelectedStudents((cur) =>
        cur.some((x) => x.id === s.id) ? cur : [...cur, s]
      );
      setSearchResults([]);
      setSearchQuery("");
      return;
    }
    setSelectedStudent(s);
    setSearchResults([]);
    setSearchQuery(`${s.firstName} ${s.lastName} (${s.studentId})`);
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setSearchQuery("");
  };

  const removeStudent = (id: number) =>
    setSelectedStudents((cur) => cur.filter((s) => s.id !== id));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!startSemester || previewPeriods.length === 0) {
      setError("Choose a valid starting semester.");
      return;
    }
    if (mode === "class" && !classId) { setError("Select a class."); return; }
    if (mode === "student" && !selectedStudent) { setError("Select a student."); return; }
    if (mode === "students" && selectedStudents.length === 0) {
      setError("Select at least one student.");
      return;
    }

    // Build studentIds
    let studentIds: number[] = [];
    const perStudentPerSemester: Record<string, number> = {};

    if (mode === "class") {
      // fetch active students in this class
      try {
        const res = await authFetch(`/api/students?classId=${classId}&status=Admitted&pageSize=500`);
        if (!res.ok) { setError("Failed to load students in class."); return; }
        const data = await res.json();
        const items: SearchStudent[] = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
            ? data.items
            : [];
        if (items.length === 0) { setError("No admitted students in this class."); return; }
        studentIds = items.map((s) => s.id);
        for (const s of items) {
          perStudentPerSemester[String(s.id)] = effectivePer(s);
        }
      } catch { setError("Failed to load students."); return; }
    } else {
      const studs = previewStudents;
      studentIds = studs.map((s) => s.id);
      for (const s of studs) {
        perStudentPerSemester[String(s.id)] = effectivePer(s);
      }
    }

    setSubmitting(true);
    try {
      const res = await authFetch("/api/students/bulk-tuition-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds,
          semesterCount: mode === "class" ? 1 : semesterCount,
          startingSemester: startSemester,
          startingYear: startYear,
          perStudentPerSemester,
          classId: mode === "class" ? Number(classId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Charge failed."); return; }
      setResult({
        charged: data.charged ?? 0,
        skipped: data.skipped ?? 0,
        results: Array.isArray(data.results) ? data.results : [],
        skippedDetails: Array.isArray(data.skippedDetails) ? data.skippedDetails : undefined,
      });
      // reset student selections
      if (mode === "student") handleClearStudent();
      if (mode === "students") { setSelectedStudents([]); setSearchQuery(""); }
      setNote("");
      setPerSemesterInputs({});
    } catch {
      setError("Request failed. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    canCharge &&
    !submitting &&
    previewPeriods.length > 0 &&
    ((mode === "class" && !!classId) ||
      (mode === "student" && !!selectedStudent) ||
      (mode === "students" && selectedStudents.length > 0));

  // ── Render ────────────────────────────────────────────────────────────────
  if (!canCharge) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Charge Tuition" />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/5">
          <p className="text-gray-500 dark:text-gray-400">
            You do not have permission to charge tuition fees.
          </p>
        </div>
      </div>
    );
  }

  const selectedClass = classOptions.find((c) => String(c.id) === classId);

  return (
    <div>
      <PageBreadCrumb pageTitle="Charge Tuition" />

      <div className="mx-auto max-w-4xl min-w-0">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <FileText className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  Charge Tuition Fee
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Invoice a whole class, one student, or multiple students for one or more semesters
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
            {/* Error */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-500/10 dark:text-error-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                <span>{error}</span>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <CheckCircle2
                    className="h-5 w-5 text-success-600 dark:text-success-400"
                    strokeWidth={1.8}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      Tuition charged successfully
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {result.charged} charged
                      {result.skipped > 0 ? ` · ${result.skipped} skipped` : ""}
                    </p>
                  </div>
                  <Badge color="success" size="sm">Complete</Badge>
                </div>

                {result.results.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-transparent! hover:bg-transparent!">
                          <TableCell isHeader>Student</TableCell>
                          <TableCell isHeader>Terms charged</TableCell>
                          <TableCell isHeader className="text-right">Per semester</TableCell>
                          <TableCell isHeader className="text-right">Total charged</TableCell>
                          <TableCell isHeader className="text-right">New balance</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.results.map((r) => (
                          <TableRow key={r.studentId}>
                            <TableCell>
                              <p className="font-medium text-gray-800 dark:text-white/90">
                                {r.firstName} {r.lastName}
                              </p>
                              <p className="font-mono text-xs text-gray-500">{r.studentId}</p>
                            </TableCell>
                            <TableCell>
                              {r.periodsCharged?.map((p, i) => (
                                <span key={i} className="mr-1.5 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                                  {p.semester} {p.year}
                                </span>
                              ))}
                              {r.periodsSkipped != null && r.periodsSkipped > 0 && (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                                  <SkipForward className="h-3 w-3" />
                                  {r.periodsSkipped} already billed
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              ${fmtAmt(r.perSemester)}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              ${fmtAmt(r.charge)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-gray-600 dark:text-gray-400">
                              ${fmtAmt(r.newBalance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {result.skippedDetails && result.skippedDetails.length > 0 && (
                  <details className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                    <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400">
                      Skipped ({result.skippedDetails.length})
                    </summary>
                    <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      {result.skippedDetails.map((s) => (
                        <li key={s.id}>
                          <span className="font-mono text-xs">#{s.id}</span> — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="space-y-5">
              {/* Mode toggle */}
              <div>
                <p className={labelCls}>Apply to</p>
                <div className="inline-flex flex-wrap rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                  {([
                    { value: "class" as const, label: "Whole class", icon: Users },
                    { value: "student" as const, label: "One student", icon: UserRound },
                    { value: "students" as const, label: "Multiple students", icon: Users },
                  ] as const).map(({ value, label, icon: Icon }) => {
                    const active = mode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => switchMode(value)}
                        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-brand-500 text-white shadow-sm"
                            : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Class selector: department first, then class */}
              {mode === "class" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="charge-department" className={labelCls}>Department</label>
                    <select
                      id="charge-department"
                      value={departmentId}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      required
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
                    <label htmlFor="charge-class" className={labelCls}>Class</label>
                    <select
                      id="charge-class"
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      disabled={!departmentId || classesLoading}
                      required
                      className={selectCls}
                    >
                      <option value="">
                        {!departmentId
                          ? "Select a department first"
                          : classesLoading
                            ? "Loading…"
                            : classesForDepartment.length === 0
                              ? "No classes in this department"
                              : "Select class"}
                      </option>
                      {classesForDepartment.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name} ({c.semester} {c.year})
                          {typeof c.activeStudentCount === "number" ? ` · ${c.activeStudentCount} students` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedClass && (
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        This class is billed for <strong>{selectedClass.semester} {selectedClass.year}</strong>.
                        Students already charged for that term are skipped.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Student search */
                <div className="space-y-3">
                  <div>
                    <label className={`${labelCls} flex items-center gap-1.5`}>
                      <UserRound className="h-4 w-4 text-brand-500" strokeWidth={1.8} />
                      {mode === "students" ? "Search students" : "Student"}
                    </label>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                        strokeWidth={1.8}
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (mode === "student" && !e.target.value) setSelectedStudent(null);
                        }}
                        placeholder="Name, phone, or student ID"
                        className={`${inputCls} pl-9 pr-10`}
                      />
                      {searchLoading && (
                        <Loader2
                          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-500"
                          strokeWidth={1.8}
                        />
                      )}
                      {mode === "student" && selectedStudent && !searchLoading && (
                        <button
                          type="button"
                          onClick={handleClearStudent}
                          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
                          aria-label="Clear student"
                        >
                          <X className="h-4 w-4" strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dropdown results */}
                  {searchResults.length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                      {searchResults.map((s) => {
                        const alreadyPicked = mode === "students" && selectedStudents.some((x) => x.id === s.id);
                        const per = perSemesterTuition(s.department.tuitionFee ?? 0, s.paymentStatus, s.customSemesterFee);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSelectStudent(s)}
                            disabled={alreadyPicked}
                            className="flex w-full items-start gap-3 border-b border-gray-100 px-3 py-3 text-left transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-60 dark:border-gray-800 dark:hover:bg-white/5 last:border-0"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                              <User className="h-4 w-4" strokeWidth={1.8} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                                {s.firstName} {s.lastName}
                              </p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-mono">{s.studentId}</span>
                                {s.phone && <span>{s.phone}</span>}
                                <span className="inline-flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {s.department.code}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <CircleDollarSign className="h-3 w-3" />
                                  {per > 0 ? `$${fmtAmt(per)}/sem` : "Full scholarship"}
                                </span>
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Single student card */}
                  {mode === "student" && selectedStudent && (
                    <div className="rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-3 dark:border-brand-800/50 dark:bg-brand-500/10">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                          <UserRound className="h-4 w-4" strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 dark:text-white/90">
                            {selectedStudent.firstName} {selectedStudent.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-mono">{selectedStudent.studentId}</span>
                            {" · "}{selectedStudent.department.code}
                            {" · "}
                            {selectedStudent.paymentStatus}
                            {" · Balance: $"}
                            {fmtAmt(selectedStudent.balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Multi-student chips */}
                  {mode === "students" && selectedStudents.length > 0 && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                          Selected ({selectedStudents.length})
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedStudents([])}
                          className="text-xs font-medium text-gray-500 hover:text-gray-800"
                        >
                          Clear all
                        </button>
                      </div>
                      <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
                        {selectedStudents.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 dark:text-white/90">
                                {s.firstName} {s.lastName}
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="font-mono">{s.studentId}</span>
                                {" · "}{s.department.code}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                ${fmtAmt(effectivePer(s))}/sem
                              </span>
                              <button
                                type="button"
                                onClick={() => removeStudent(s.id)}
                                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Semester settings */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="sem-count" className={labelCls}>
                    Number of semesters
                  </label>
                  <input
                    id="sem-count"
                    type="number"
                    min={1}
                    max={24}
                    value={mode === "class" ? 1 : semesterCount}
                    disabled={mode === "class"}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setSemesterCount(Number.isFinite(n) ? Math.max(1, Math.min(24, n)) : 1);
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="first-sem" className={labelCls}>First semester</label>
                  <select
                    id="first-sem"
                    value={startSemester}
                    disabled={mode === "class"}
                    onChange={(e) => setStartSemester(e.target.value)}
                    className={selectCls}
                  >
                    {semesters.length === 0 && !startSemester ? (
                      <option value="">Loading semesters…</option>
                    ) : (
                      <>
                        {startSemester &&
                        !semesters.some((s) => s.name === startSemester) ? (
                          <option value={startSemester}>{startSemester}</option>
                        ) : null}
                        {semesters.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="first-year" className={labelCls}>First year</label>
                  <input
                    id="first-year"
                    type="number"
                    min={2000}
                    max={2100}
                    value={startYear}
                    disabled={mode === "class"}
                    onChange={(e) => {
                      const y = parseInt(e.target.value, 10);
                      setStartYear(Number.isFinite(y) ? y : CURRENT_YEAR);
                    }}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Period preview */}
              {previewPeriods.length > 0 && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Terms on invoice: </span>
                  {previewPeriods.map((p, i) => (
                    <span key={i}>
                      {i > 0 && " · "}
                      <span className="font-medium text-gray-800 dark:text-white/80">
                        {p.semester} {p.year}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {startSemester && previewPeriods.length === 0 && semesters.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Could not build term list — check that the semester matches an active semester in Settings.
                </p>
              )}

              {/* Per-student overrides (student / students mode) */}
              {previewStudents.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-white/5">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Student</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Status</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Per semester ($)</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                          Total ({previewPeriods.length} sem)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {previewStudents.map((s) => {
                        const per = effectivePer(s);
                        const total = per * previewPeriods.length;
                        return (
                          <tr key={s.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800 dark:text-white/90">
                                {s.firstName} {s.lastName}
                              </p>
                              <p className="font-mono text-xs text-gray-500">{s.studentId}</p>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                              {s.paymentStatus}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={perSemesterInputs[s.id] ?? ""}
                                placeholder={fmtAmt(perSemesterTuition(s.department.tuitionFee ?? 0, s.paymentStatus, s.customSemesterFee))}
                                onChange={(e) =>
                                  setPerSemesterInputs((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                                className="h-9 w-full min-w-[7rem] rounded-lg border border-gray-200 bg-white px-2 text-right text-sm tabular-nums text-gray-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-800 dark:text-white/90">
                              ${fmtAmt(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {previewStudents.length > 1 && (
                      <tfoot className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-white/5">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                            Grand total
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                            ${fmtAmt(previewTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* Note */}
              <div>
                <label htmlFor="charge-note" className={labelCls}>
                  Note <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="charge-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Semester 1 2025 tuition"
                  className={inputCls}
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end border-t border-gray-100 pt-5 dark:border-gray-800">
                <Button type="submit" disabled={!canSubmit} size="sm">
                  {submitting
                    ? "Charging…"
                    : mode === "class"
                      ? "Charge whole class"
                      : mode === "students"
                        ? `Charge ${selectedStudents.length || ""} students`.trim()
                        : "Charge student"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
