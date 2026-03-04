"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { authFetch } from "@/lib/api";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type ChartData = {
  revenueByMonth: { month: string; total: number }[];
};

export default function RevenueChart() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.chartData) setData(d.chartData);
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

  const categories = data.revenueByMonth.map((m) => m.month);
  const revenueData = data.revenueByMonth.map((m) => m.total);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ["#465FFF"],
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: { opacityFrom: 0.4, opacityTo: 0.05 },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { formatter: (v) => `$${Number(v).toLocaleString()}` },
    },
    legend: { show: false },
    grid: {
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    tooltip: {
      y: { formatter: (v) => `$${Number(v).toLocaleString()}` },
    },
  };

  const series = [{ name: "Revenue", data: revenueData }];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm dark:border-gray-800 dark:bg-white/5 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400">
          <span className="text-lg">$</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tuition Revenue</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Current year — real data</p>
        </div>
      </div>
      <div className="min-h-[280px]">
        <ReactApexChart options={options} series={series} type="area" height={280} />
      </div>
    </div>
  );
}
