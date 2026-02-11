"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import { authFetch } from "@/lib/api";

type AttendanceItem = {
  id: number;
  class: { name: string; course: { code: string; name: string } };
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

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/5 sm:px-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Recent Attendance
        </h3>
        <Link
          href="/attendance"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
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
              sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="py-3">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {s.class?.course?.code} – {s.class?.name}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {s.class?.course?.name}
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
      </div>
    </div>
  );
}
