"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { authFetch } from "@/lib/api";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type ChartData = {
  attendanceByMonth: { month: string; count: number }[];
};

export default function AttendanceChart() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.chartData?.attendanceByMonth) {
          setData({ attendanceByMonth: d.chartData.attendanceByMonth });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm dark:border-gray-800 dark:bg-white/5 sm:px-6">
        <div className="h-8 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-6 h-[280px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  const categories = data.attendanceByMonth.map((m) => m.month);
  const seriesData = data.attendanceByMonth.map((m) => m.count);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Roboto, sans-serif",
      toolbar: { show: false },
      type: "bar",
    },
    colors: ["#6366f1"],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 6,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ["transparent"] },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      title: { text: "Sessions" },
      labels: { formatter: (v) => Math.round(Number(v)).toString() },
    },
    grid: {
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    fill: { opacity: 1 },
    tooltip: {
      y: { formatter: (v) => `${v} sessions` },
    },
  };

  const series = [{ name: "Attendance Sessions", data: seriesData }];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm dark:border-gray-800 dark:bg-white/5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
            <span className="text-sm font-bold">✓</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance Sessions</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current year — real data</p>
          </div>
        </div>
        <Link
          href="/attendance"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          View all
        </Link>
      </div>
      <div className="min-h-[280px]">
        <ReactApexChart options={options} series={series} type="bar" height={280} />
      </div>
    </div>
  );
}
