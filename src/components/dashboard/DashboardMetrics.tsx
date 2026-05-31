"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  GroupIcon,
  TableIcon,
  ListIcon,
  CalenderIcon,
  PieChartIcon,
  PageIcon,
  ArrowRightIcon,
} from "@/icons";
import { authFetch } from "@/lib/api";

type DashboardCounts = {
  users: number;
  students: number;
  admitted: number;
  roles: number;
  faculties: number;
  departments: number;
  courses: number;
  classes: number;
  attendance: number;
  examRecords: number;
};

const metricCards: {
  key: keyof DashboardCounts;
  label: string;
  icon: React.ReactNode;
  href: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    key: "users",
    label: "Users",
    icon: <GroupIcon className="size-6" />,
    href: "/users",
    gradient: "from-violet-500/10 via-violet-500/5 to-transparent dark:from-violet-500/20 dark:via-violet-500/10",
    iconBg: "bg-violet-500/15 dark:bg-violet-500/25",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    key: "admitted",
    label: "Students",
    icon: <PageIcon className="size-6" />,
    href: "/admission",
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10",
    iconBg: "bg-emerald-500/15 dark:bg-emerald-500/25",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "courses",
    label: "Courses",
    icon: <ListIcon className="size-6" />,
    href: "/courses",
    gradient: "from-sky-500/10 via-sky-500/5 to-transparent dark:from-sky-500/20 dark:via-sky-500/10",
    iconBg: "bg-sky-500/15 dark:bg-sky-500/25",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  {
    key: "classes",
    label: "Classes",
    icon: <TableIcon className="size-6" />,
    href: "/classes",
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-amber-500/10",
    iconBg: "bg-amber-500/15 dark:bg-amber-500/25",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "attendance",
    label: "Attendance Sessions",
    icon: <CalenderIcon className="size-6" />,
    href: "/attendance",
    gradient: "from-brand-500/10 via-brand-500/5 to-transparent dark:from-brand-500/20 dark:via-brand-500/10",
    iconBg: "bg-brand-500/15 dark:bg-brand-500/25",
    iconColor: "text-brand-600 dark:text-brand-400",
  },
  {
    key: "examRecords",
    label: "Exam Records",
    icon: <PieChartIcon className="size-6" />,
    href: "/examinations",
    gradient: "from-teal-500/10 via-teal-500/5 to-transparent dark:from-teal-500/20 dark:via-teal-500/10",
    iconBg: "bg-teal-500/15 dark:bg-teal-500/25",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
];

export default function DashboardMetrics() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/dashboard")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.counts) setCounts(data.counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/5 md:p-6 animate-pulse"
          >
            <div className="h-14 w-14 rounded-2xl bg-gray-200 dark:bg-gray-800" />
            <div className="mt-5 h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 h-9 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
      {metricCards.map(({ key, label, icon, href, gradient, iconBg, iconColor }) => (
        <Link key={key} href={href} className="group">
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 dark:border-gray-800 dark:bg-white/5 dark:hover:border-gray-700 md:p-6">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-100`} />
            <div className="relative">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconBg} ${iconColor} transition-transform group-hover:scale-110`}>
                {icon}
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
                  <h4 className="mt-1.5 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {(counts?.[key] ?? 0).toLocaleString()}
                  </h4>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors group-hover:bg-brand-500 group-hover:text-white dark:bg-gray-800 dark:group-hover:bg-brand-500">
                  <ArrowRightIcon className="size-4" />
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
