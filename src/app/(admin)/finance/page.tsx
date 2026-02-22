"use client";

import React, { useEffect, useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { DownloadIcon } from "@/icons";

type SemesterOption = { id: number; name: string; sortOrder: number; isActive: boolean };
type ClassOption = { id: number; name: string; semester: string; year: number; course: { code: string; name: string } };
type UnpaidStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  department: { name: string; code: string; tuitionFee: number | null };
  tuitionFee: number | null;
};
const CURRENT_YEAR = new Date().getFullYear();

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Pay tuition
  const [payStudentId, setPayStudentId] = useState("");
  const [paySemester, setPaySemester] = useState("");
  const [payYear, setPayYear] = useState(String(CURRENT_YEAR));
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const [paySuccess, setPaySuccess] = useState(false);
  const [lookedUpStudent, setLookedUpStudent] = useState<{
    studentId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    motherName: string | null;
    parentPhone: string | null;
    department: { name: string; code: string; tuitionFee: number | null };
    class: { name: string; semester: string; year: number; course: { code: string } } | null;
    program: string | null;
    status: string;
    tuitionPayments: { semester: string; year: number; amount: number }[];
  } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

  // Unpaid students
  const [unpaidSemester, setUnpaidSemester] = useState("");
  const [unpaidYear, setUnpaidYear] = useState(String(CURRENT_YEAR));
  const [unpaidClassId, setUnpaidClassId] = useState("");
  const [unpaidStudents, setUnpaidStudents] = useState<UnpaidStudent[]>([]);
  const [unpaidClassInfo, setUnpaidClassInfo] = useState<{ name: string; semester: string; year: number; course: { code: string; name: string } } | null>(null);
  const [unpaidLoading, setUnpaidLoading] = useState(false);

  const handleLookupStudent = async () => {
    const id = payStudentId.trim();
    if (!id) return;
    setLookupError("");
    setLookedUpStudent(null);
    setLookupLoading(true);
    try {
      const res = await authFetch(`/api/students/by-id/${encodeURIComponent(id)}`);
      if (!res.ok) {
        setLookupError("Student not found");
        return;
      }
      const s = await res.json();
      setLookedUpStudent({
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phone: s.phone,
        motherName: s.motherName,
        parentPhone: s.parentPhone,
        department: { name: s.department.name, code: s.department.code, tuitionFee: s.department.tuitionFee },
        class: s.class ? { name: s.class.name, semester: s.class.semester, year: s.class.year, course: { code: s.class.course?.code } } : null,
        program: s.program,
        status: s.status,
        tuitionPayments: (s.tuitionPayments || []).map((p: { semester: string; year: number; amount: number }) => ({ semester: p.semester, year: p.year, amount: p.amount })),
      });
      if (!payAmount && s.department?.tuitionFee != null && s.department.tuitionFee > 0) {
        setPayAmount(String(s.department.tuitionFee));
      }
    } catch {
      setLookupError("Failed to fetch student");
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
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
    if (semesters.length > 0 && !paySemester) setPaySemester(semesters[0].name);
  }, [semesters, paySemester]);

  useEffect(() => {
    if (semesters.length > 0 && !unpaidSemester) setUnpaidSemester(semesters[0].name);
  }, [semesters, unpaidSemester]);

  const filteredClasses = classes.filter(
    (c) => c.semester === unpaidSemester && c.year === Number(unpaidYear)
  );

  useEffect(() => {
    if (unpaidClassId && !filteredClasses.some((c) => c.id === Number(unpaidClassId))) {
      setUnpaidClassId("");
    }
  }, [filteredClasses, unpaidClassId]);

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
    a.download = `Unpaid_Students_${unpaidClassInfo?.course?.code || "class"}_${unpaidSemester}_${unpaidYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePayStudentIdChange = (val: string) => {
    setPayStudentId(val);
    setLookedUpStudent(null);
    setLookupError("");
  };

  const handlePayTuition = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError("");
    setPaySuccess(false);
    setPaySubmitting(true);
    try {
      const res = await authFetch("/api/tuition-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: payStudentId.trim(),
          semester: paySemester,
          year: Number(payYear),
          amount: payAmount ? Number(payAmount) : undefined,
          note: payNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayError(data.error || "Payment failed");
        return;
      }
      setPaySuccess(true);
      setPayStudentId("");
      setPayAmount("");
      setPayNote("");
      setLookedUpStudent(null);
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

  return (
    <div>
      <PageBreadCrumb pageTitle="Finance" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Record tuition payments. View{" "}
          <Link href="/reports/payment" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Payment Report
          </Link>{" "}
          for student transactions and class revenue.
        </p>
      </div>

      {/* Pay Tuition */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            Record Tuition Payment
          </h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Enter the student ID (e.g. STD-2026-0001) to record a tuition payment. Amount defaults to department tuition fee.
          </p>
          <form onSubmit={handlePayTuition} className="max-w-xl space-y-4">
            {payError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {payError}
              </div>
            )}
            {paySuccess && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-500/10 dark:text-green-400">
                Payment recorded successfully.
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Student ID <span className="text-error-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={payStudentId}
                  onChange={(e) => handlePayStudentIdChange(e.target.value.toUpperCase())}
                  placeholder="STD-2026-0001"
                  className="h-11 flex-1 rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm font-mono text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLookupStudent}
                  disabled={!payStudentId.trim() || lookupLoading}
                >
                  {lookupLoading ? "..." : "Lookup"}
                </Button>
              </div>
              {lookupError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{lookupError}</p>
              )}
            </div>
            {lookedUpStudent && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-white/5">
                <h4 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Student Information</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {lookedUpStudent.firstName} {lookedUpStudent.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Student ID</p>
                    <p className="font-mono font-medium text-gray-800 dark:text-white/90">{lookedUpStudent.studentId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Department</p>
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {lookedUpStudent.department.name} ({lookedUpStudent.department.code})
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tuition Fee</p>
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {lookedUpStudent.department.tuitionFee != null
                        ? `$${Number(lookedUpStudent.department.tuitionFee).toLocaleString()}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Class</p>
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {lookedUpStudent.class
                        ? `${lookedUpStudent.class.course?.code} ${lookedUpStudent.class.name} (${lookedUpStudent.class.semester} ${lookedUpStudent.class.year})`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Program</p>
                    <p className="font-medium text-gray-800 dark:text-white/90">{lookedUpStudent.program || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                    <p className="font-medium text-gray-800 dark:text-white/90">{lookedUpStudent.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                    <p className="font-medium text-gray-800 dark:text-white/90">{lookedUpStudent.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mother / Parent</p>
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {lookedUpStudent.motherName || "—"}
                      {lookedUpStudent.parentPhone && ` · ${lookedUpStudent.parentPhone}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <Badge color="success" size="sm">{lookedUpStudent.status}</Badge>
                  </div>
                </div>
                {lookedUpStudent.tuitionPayments.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Payment History</p>
                    <div className="flex flex-wrap gap-2">
                      {lookedUpStudent.tuitionPayments.map((p) => (
                        <Badge key={`${p.semester}-${p.year}`} color="success" size="sm">
                          {p.semester} {p.year}: ${p.amount.toLocaleString()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
                <select
                  value={paySemester}
                  onChange={(e) => setPaySemester(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                <input
                  type="number"
                  value={payYear}
                  onChange={(e) => setPayYear(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount (optional – uses department tuition fee if empty)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Leave empty for department default"
                className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Note</label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Optional note"
                className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/40"
              />
            </div>
            <Button type="submit" disabled={paySubmitting} size="sm">
              {paySubmitting ? "Processing..." : "Record Payment"}
            </Button>
          </form>
        </div>

      {/* Unpaid Students */}
      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Unpaid Students by Semester & Class
        </h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Select a semester, year, and class to generate a list of students who have not paid tuition for that term.
        </p>
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
            <select
              value={unpaidSemester}
              onChange={(e) => setUnpaidSemester(e.target.value)}
              className="h-10 min-w-[120px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
            <input
              type="number"
              value={unpaidYear}
              onChange={(e) => setUnpaidYear(e.target.value)}
              className="h-10 min-w-[100px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Class</label>
            <select
              value={unpaidClassId}
              onChange={(e) => setUnpaidClassId(e.target.value)}
              className="h-10 min-w-[200px] rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
            >
              <option value="">Select class</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course.code} - {c.name} ({c.semester} {c.year})
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

        {unpaidClassInfo && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {unpaidClassInfo.course.code} - {unpaidClassInfo.name} ({unpaidClassInfo.semester} {unpaidClassInfo.year})
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
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center dark:border-gray-700 dark:bg-white/5">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  All students in this class have paid for {unpaidClassInfo.semester} {unpaidClassInfo.year}.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-transparent! hover:bg-transparent!">
                      <TableCell isHeader>Student ID</TableCell>
                      <TableCell isHeader>Name</TableCell>
                      <TableCell isHeader>Email</TableCell>
                      <TableCell isHeader>Phone</TableCell>
                      <TableCell isHeader>Department</TableCell>
                      <TableCell isHeader className="text-right">Tuition Fee</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidStudents.map((s) => (
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
                        <TableCell className="text-right">
                          {s.tuitionFee != null ? `$${Number(s.tuitionFee).toLocaleString()}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
