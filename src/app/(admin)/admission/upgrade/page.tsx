"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeftIcon } from "@/icons";

type ClassOption = {
  id: number;
  name: string;
  semester: string;
  year: number;
  course: { code: string; department?: { id: number } };
};

type SearchStudent = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  department: { id: number; name: string; code: string };
  class: { id: number; name: string; semester: string; year: number; course: { code: string } } | null;
};

export default function UpgradeStudentsPage() {
  const { hasPermission } = useAuth();
  const [mode, setMode] = useState<"class" | "student">("class");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sourceClassId, setSourceClassId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SearchStudent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ count: number; target: string } | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canUpgrade = hasPermission("admission.edit");

  useEffect(() => {
    authFetch("/api/classes").then(async (r) => {
      if (r.ok) {
        const d: ClassOption[] = await r.json();
        setClasses(
          d.map((c: ClassOption & { course?: { code?: string; department?: { id: number } } }) => ({
            id: c.id,
            name: c.name,
            semester: c.semester,
            year: c.year,
            course: { code: c.course?.code ?? "", department: c.course?.department },
          }))
        );
      }
    });
  }, []);

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

  const sourceClass = classes.find((c) => c.id === Number(sourceClassId));
  const targetClass = classes.find((c) => c.id === Number(targetClassId));

  // For class upgrade: filter target classes to same department
  const sourceDeptId = sourceClass?.course?.department?.id;
  const targetClassOptions = sourceClass
    ? classes.filter((c) => c.course?.department?.id === sourceDeptId && c.id !== Number(sourceClassId))
    : classes;

  // For single student: filter target classes to student's department
  const targetClassOptionsForStudent = selectedStudent
    ? classes.filter((c) => c.course?.department?.id === selectedStudent.department.id)
    : classes;

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(null);
    setSubmitting(true);
    try {
      let body: { classId?: number; studentId?: number; targetClassId: number } = {
        targetClassId: Number(targetClassId),
      };
      if (mode === "class") {
        if (!sourceClassId) {
          setError("Select a source class");
          setSubmitting(false);
          return;
        }
        body.classId = Number(sourceClassId);
      } else {
        if (!selectedStudent) {
          setError("Select a student");
          setSubmitting(false);
          return;
        }
        body.studentId = selectedStudent.id;
      }

      const res = await authFetch("/api/students/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upgrade failed");
        setSubmitting(false);
        return;
      }
      setSuccess({ count: data.upgraded, target: `${data.targetClass.name} (${data.targetClass.semester} ${data.targetClass.year})` });
      if (mode === "class") {
        setSourceClassId("");
        setTargetClassId("");
      } else {
        setSelectedStudent(null);
        setSearchQuery("");
        setTargetClassId("");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canUpgrade) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Upgrade Students" />
        <p className="text-gray-500 dark:text-gray-400">You do not have permission to upgrade students.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageBreadCrumb pageTitle="Upgrade Students" />
        <Link href="/admission">
          <Button variant="outline" size="sm" startIcon={<ChevronLeftIcon />}>
            Back to Admission
          </Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => { setMode("class"); setError(""); setSuccess(null); setSourceClassId(""); setTargetClassId(""); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "class"
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            Upgrade Entire Class
          </button>
          <button
            type="button"
            onClick={() => { setMode("student"); setError(""); setSuccess(null); setSelectedStudent(null); setSearchQuery(""); setTargetClassId(""); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "student"
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            Upgrade Single Student
          </button>
        </div>

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
            Successfully upgraded {success.count} student(s) to {success.target}.
          </div>
        )}

        <form onSubmit={handleUpgrade} className="space-y-6">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {mode === "class" ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">Source Class (students to upgrade)</label>
                <select
                  value={sourceClassId}
                  onChange={(e) => { setSourceClassId(e.target.value); setTargetClassId(""); }}
                  className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  required
                >
                  <option value="">— Select class —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.course.code} ({c.semester} {c.year})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Target Class (upgrade to)</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  required
                >
                  <option value="">— Select target class —</option>
                  {targetClassOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.course.code} ({c.semester} {c.year})
                    </option>
                  ))}
                  {sourceClassId && targetClassOptions.length === 0 && (
                    <option value="" disabled>No other classes in same department</option>
                  )}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">Search Student</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, student ID, email..."
                  className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                {searchLoading && <p className="mt-1 text-xs text-gray-500">Searching...</p>}
                {searchResults.length > 0 && !selectedStudent && (
                  <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    {searchResults.map((s) => (
                      <li
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedStudent(s);
                          setSearchResults([]);
                          setSearchQuery(`${s.firstName} ${s.lastName} (${s.studentId})`);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && setSelectedStudent(s)}
                        className="cursor-pointer border-b border-gray-100 px-4 py-2 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                      >
                        {s.firstName} {s.lastName} — {s.studentId} — {s.department.code}
                        {s.class && ` (${s.class.name})`}
                      </li>
                    ))}
                  </ul>
                )}
                {selectedStudent && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 dark:border-green-800 dark:bg-green-900/20">
                    <span className="font-medium">
                      {selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.studentId})
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setSelectedStudent(null); setSearchQuery(""); }}
                    >
                      Change
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Target Class</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  required
                >
                  <option value="">— Select target class —</option>
                  {targetClassOptionsForStudent.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.course.code} ({c.semester} {c.year})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Upgrading..." : "Upgrade"}
          </Button>
        </form>
      </div>
    </div>
  );
}
