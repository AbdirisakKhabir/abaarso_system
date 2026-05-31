"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const moneyFmt = (v: number) => `$${Number(v).toLocaleString()}`;

const baseChart = (foreColor: string, gridColor: string): Partial<ApexOptions> => ({
  chart: {
    fontFamily: "inherit",
    toolbar: { show: false },
    zoom: { enabled: false },
    foreColor,
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: gridColor,
    strokeDashArray: 3,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
  },
  legend: {
    show: true,
    position: "bottom",
    fontSize: "11px",
    markers: { size: 6, offsetX: -2 },
  },
  tooltip: {
    theme: "light",
  },
});

type BarProps = {
  title: string;
  categories: string[];
  data: number[];
  height?: number;
  color?: string;
  valueFormatter?: (n: number) => string;
};

/** Vertical columns — neutral styling, no gradients. */
export function FinanceReportBar({
  title,
  categories,
  data,
  height = 260,
  color = "#2563eb",
  valueFormatter = moneyFmt,
}: BarProps) {
  const options: ApexOptions = useMemo(
    () => ({
      ...baseChart("#64748b", "#e2e8f0"),
      colors: [color],
      chart: { ...baseChart("#64748b", "#e2e8f0").chart, type: "bar" },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "52%",
          borderRadius: 2,
          borderRadiusApplication: "end",
        },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { rotate: categories.some((c) => c.length > 12) ? -45 : 0, maxHeight: 120 },
      },
      yaxis: {
        labels: { formatter: (v) => valueFormatter(Number(v)) },
      },
      tooltip: { y: { formatter: (v) => valueFormatter(Number(v)) } },
    legend: { show: false },
    }),
    [categories, color, valueFormatter]
  );

  const series = useMemo(() => [{ name: "Amount", data }], [data]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="px-2 pb-2 pt-1">
        <ReactApexChart options={options} series={series} type="bar" height={height} />
      </div>
    </div>
  );
}

type HBarProps = {
  title: string;
  categories: string[];
  data: number[];
  height?: number;
  valueFormatter?: (n: number) => string;
};

/** Horizontal bars for long category labels. */
export function FinanceReportBarHorizontal({
  title,
  categories,
  data,
  height = 280,
  valueFormatter = moneyFmt,
}: HBarProps) {
  const options: ApexOptions = useMemo(
    () => ({
      ...baseChart("#64748b", "#e2e8f0"),
      colors: ["#1e40af"],
      chart: { ...baseChart("#64748b", "#e2e8f0").chart, type: "bar" },
      plotOptions: {
        bar: { horizontal: true, barHeight: "70%", borderRadius: 2 },
      },
      xaxis: {
        categories,
        labels: { maxHeight: 160, style: { fontSize: "11px" } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: { formatter: (v) => valueFormatter(Number(v)) },
      },
      tooltip: { x: { show: true }, y: { formatter: (v) => valueFormatter(Number(v)) } },
      legend: { show: false },
    }),
    [categories, valueFormatter]
  );

  const series = useMemo(() => [{ name: "Amount", data }], [data]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="px-2 pb-2 pt-1">
        <ReactApexChart options={options} series={series} type="bar" height={height} />
      </div>
    </div>
  );
}

type DonutProps = {
  title: string;
  labels: string[];
  series: number[];
  height?: number;
  valueFormatter?: (n: number) => string;
};

export function FinanceReportDonut({
  title,
  labels,
  series,
  height = 280,
  valueFormatter = moneyFmt,
}: DonutProps) {
  const options: ApexOptions = useMemo(
    () => ({
      ...baseChart("#64748b", "#e2e8f0"),
      colors: ["#1e40af", "#0f766e", "#b45309", "#64748b", "#7c3aed", "#0e7490"],
      chart: { ...baseChart("#64748b", "#e2e8f0").chart, type: "donut" },
      labels,
      plotOptions: {
        pie: {
          donut: {
            size: "62%",
            labels: {
              show: true,
              total: {
                show: true,
                label: "Total",
                formatter: () =>
                  valueFormatter(series.reduce((a, b) => a + b, 0)),
              },
            },
          },
        },
      },
      dataLabels: { enabled: false },
      legend: { position: "bottom", fontSize: "11px" },
      tooltip: { y: { formatter: (v) => valueFormatter(Number(v)) } },
    }),
    [labels, series, valueFormatter]
  );

  const ser = useMemo(() => series, [series]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="flex justify-center px-2 pb-2 pt-1">
        <ReactApexChart options={options} series={ser} type="donut" height={height} />
      </div>
    </div>
  );
}

type LineProps = {
  title: string;
  categories: string[];
  data: number[];
  height?: number;
  valueFormatter?: (n: number) => string;
};

export function FinanceReportLine({
  title,
  categories,
  data,
  height = 260,
  valueFormatter = moneyFmt,
}: LineProps) {
  const options: ApexOptions = useMemo(
    () => ({
      ...baseChart("#64748b", "#e2e8f0"),
      colors: ["#2563eb"],
      chart: { ...baseChart("#64748b", "#e2e8f0").chart, type: "line" },
      stroke: { curve: "straight", width: 2 },
      markers: { size: 3, strokeWidth: 0 },
      fill: { type: "solid", opacity: 0 },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { rotate: -45, maxHeight: 100 },
      },
      yaxis: {
        labels: { formatter: (v) => valueFormatter(Number(v)) },
      },
      tooltip: { y: { formatter: (v) => valueFormatter(Number(v)) } },
      legend: { show: false },
    }),
    [categories, valueFormatter]
  );

  const series = useMemo(() => [{ name: "Amount", data }], [data]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="px-2 pb-2 pt-1">
        <ReactApexChart options={options} series={series} type="line" height={height} />
      </div>
    </div>
  );
}
