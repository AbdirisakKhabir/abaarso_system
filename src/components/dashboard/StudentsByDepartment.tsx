"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";

type DeptData = {
  departmentId: number;
  department: { name: string; code: string } | null;
  count: number;
};

export default function StudentsByDepartment() {
  const [data, setData] = useState<DeptData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.studentsByDepartment) setData(d.studentsByDepartment);
        if (d?.counts?.admitted != null) setTotal(d.counts.admitted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/5 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Students by Department
        </h3>
        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
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
            Students by Department
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Admitted students per department
          </p>
        </div>
        <Link
          href="/admission"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          View all
        </Link>
      </div>
      <div className="mt-6 space-y-5">
        {data.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No data yet.</p>
        ) : (
          data.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return (
              <div key={item.departmentId} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    {item.department?.code?.slice(0, 2) ?? "—"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-800 dark:text-white/90">
                      {item.department?.name ?? "Unknown"}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.count} students
                    </span>
                  </div>
                </div>
                <div className="flex w-full max-w-[140px] items-center gap-3">
                  <div className="relative block h-2 w-full max-w-[100px] overflow-hidden rounded-sm bg-gray-200 dark:bg-gray-800">
                    <div
                      className="absolute left-0 top-0 h-full rounded-sm bg-brand-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-medium text-gray-800 dark:text-white/90">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
