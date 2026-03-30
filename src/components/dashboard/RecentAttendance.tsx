"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
import { authFetch } from "@/lib/api";
import { CalenderIcon } from "@/icons";

type AttendanceItem = {
  id: number;
  class: { name: string; department: { code: string; name: string } };
  date: string;
  shift: string;
  takenBy: { name: string | null };
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  takenAt: string;
};

export default function RecentAttendance() {
  const [sessions, setSessions] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.recentAttendance) setSessions(data.recentAttendance);
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
    total: sessionsTotal,
    from,
    to,
  } = usePagination(sessions, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-4 shadow-sm dark:border-gray-800 dark:bg-white/5 sm:px-6 sm:pb-6">
      <div className="mb-4 flex flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
            <CalenderIcon className="size-5" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Attendance
          </h3>
        </div>
        <Link
          href="/attendance"
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
                Class
              </TableCell>
              <TableCell isHeader className="py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Date
              </TableCell>
              <TableCell isHeader className="py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Shift
              </TableCell>
              <TableCell isHeader className="py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Present / Absent
              </TableCell>
              <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                By
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-gray-500">
                  No attendance sessions yet.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="py-3">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {s.class?.department?.code} – {s.class?.name}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {s.class?.department?.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-center text-sm text-gray-600 dark:text-gray-300">
                    {new Date(s.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <Badge variant="light" color="info" size="sm">
                      {s.shift}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">{s.present}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-sm text-red-600 dark:text-red-400">{s.absent}</span>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-300">
                    {s.takenBy?.name ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          totalPages={totalPages}
          total={sessionsTotal}
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
