"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { authFetch } from "@/lib/api";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type StatusItem = { status: string; count: number };

const STATUS_COLORS: Record<string, string> = {
  Admitted: "#10b981",
  Pending: "#f59e0b",
  Rejected: "#ef4444",
  Graduated: "#6366f1",
};

export default function StudentsByStatusChart() {
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

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm dark:border-gray-800 dark:bg-white/5 sm:px-6">
        <div className="h-8 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-6 h-[280px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  const series = data.map((d) => d.count);
  const labels = data.map((d) => d.status);
  const colors = data.map((d) => STATUS_COLORS[d.status] ?? "#6366f1");

  const options: ApexOptions = {
    chart: {
      fontFamily: "Roboto, sans-serif",
      type: "donut",
      toolbar: { show: false },
    },
    colors,
    labels,
    legend: {
      position: "bottom",
      horizontalAlign: "center",
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${Math.round(val)}%`,
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              formatter: () => {
                const total = data.reduce((s, i) => s + i.count, 0);
                return total.toString();
              },
            },
          },
        },
      },
    },
    tooltip: {
      y: { formatter: (val: number) => `${val} students` },
    },
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm dark:border-gray-800 dark:bg-white/5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:bg-violet-500/25 dark:text-violet-400">
            <span className="text-sm font-bold">%</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Students by Status</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Applicants — donut chart</p>
          </div>
        </div>
        <Link
          href="/admission"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          View all
        </Link>
      </div>
      {data.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-gray-500">No data yet.</div>
      ) : (
        <div className="min-h-[280px]">
          <ReactApexChart options={options} series={series} type="donut" height={280} />
        </div>
      )}
    </div>
  );
}
