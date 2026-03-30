"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "../ui/table";
import { usePagination } from "@/hooks/usePagination";
import Badge from "../ui/badge/Badge";
import { PageIcon } from "@/icons";

type Student = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  status: string;
  admissionDate: string;
  department: { name: string; code: string };
};

export default function RecentStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.recentStudents) setStudents(data.recentStudents);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const {
    paginatedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: studentsTotal,
    from,
    to,
  } = usePagination(students, []);

  const statusColor = (s: string) =>
    s === "Admitted" ? "success" : s === "Pending" ? "warning" : s === "Rejected" ? "error" : "info";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-4 shadow-sm dark:border-gray-800 dark:bg-white/5 sm:px-6 sm:pb-6">
      <div className="mb-4 flex flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400">
            <PageIcon className="size-5" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Students
          </h3>
        </div>
        <Link
          href="/admission"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          See all
        </Link>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-y border-gray-100 dark:border-gray-800">
            <TableRow>
              <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Student
              </TableCell>
              <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Department
              </TableCell>
              <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Status
              </TableCell>
              <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Admitted
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-gray-500">
                  No students yet.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="py-3">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {s.firstName} {s.lastName}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {s.studentId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-300">
                    {s.department?.code ?? "—"}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="light" color={statusColor(s.status) as "success" | "warning" | "error" | "info"}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-300">
                    {s.admissionDate
                      ? new Date(s.admissionDate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          totalPages={totalPages}
          total={studentsTotal}
          from={from}
          to={to}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
