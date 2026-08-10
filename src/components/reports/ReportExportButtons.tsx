"use client";

import React from "react";
import Button from "@/components/ui/button/Button";
import { DownloadIcon } from "@/icons";
import {
  exportReportExcel,
  exportReportPdf,
  type ReportExportCell,
} from "@/lib/report-export";

type ReportExportButtonsProps = {
  title: string;
  filename: string;
  headers: string[];
  rows: ReportExportCell[][];
  subtitle?: string;
  footerRows?: ReportExportCell[][];
  disabled?: boolean;
  onPrint?: () => void;
  className?: string;
};

export function ReportExportButtons({
  title,
  filename,
  headers,
  rows,
  subtitle,
  footerRows,
  disabled = false,
  onPrint,
  className = "",
}: ReportExportButtonsProps) {
  const canExport = !disabled && rows.length > 0 && headers.length > 0;
  const payload = { title, filename, headers, rows, subtitle, footerRows };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      <Button
        variant="outline"
        size="sm"
        startIcon={<DownloadIcon />}
        disabled={!canExport}
        onClick={() => void exportReportExcel(payload)}
      >
        Export Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        startIcon={<DownloadIcon />}
        disabled={!canExport}
        onClick={() => exportReportPdf(payload)}
      >
        Export PDF
      </Button>
      {onPrint && (
        <Button size="sm" onClick={onPrint}>
          Print
        </Button>
      )}
    </div>
  );
}
