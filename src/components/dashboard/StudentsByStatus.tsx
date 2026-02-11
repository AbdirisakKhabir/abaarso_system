"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "../ui/badge/Badge";
import { authFetch } from "@/lib/api";

type StatusItem = { status: string; count: number };

const STATUS_COLORS: Record<string, "success" | "warning" | "error" | "info"> = {
  Admitted: "success",
  Pending: "warning",
  Rejected: "error",
  Graduated: "info",
};

export default function StudentsByStatus() {
  const [data, setData] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.studentsByStatus) setData(d.studentsByStatus);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = data.reduce((s, i) => s + i.count, 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/5 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Students by Status
        </h3>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/5 sm:p-6">
      <div className="flex justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Students by Status
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {total} total applicants
          </p>
        </div>
        <Link
          href="/admission"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          View all
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.map((item) => (
          <div
            key={item.status}
            className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 dark:border-gray-800 dark:bg-white/5"
          >
            <Badge variant="light" color={STATUS_COLORS[item.status] ?? "info"} size="sm">
              {item.status}
            </Badge>
            <p className="mt-2 text-xl font-bold text-gray-800 dark:text-white/90">
              {item.count}
            </p>
          </div>
        ))}
        {data.length === 0 && (
          <p className="col-span-full py-4 text-center text-sm text-gray-500">
            No data yet.
          </p>
        )}
      </div>
    </div>
  );
}
