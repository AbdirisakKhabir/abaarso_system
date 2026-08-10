import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportExportCell = string | number | null | undefined | boolean;

export type ReportExportOptions = {
  title: string;
  filename: string;
  headers: string[];
  rows: ReportExportCell[][];
  /** Optional subtitle under the title (PDF) / note sheet row */
  subtitle?: string;
  /** Extra rows appended after data (e.g. totals) */
  footerRows?: ReportExportCell[][];
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
}

function cellToString(value: ReportExportCell): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download an Excel (.xlsx) workbook with one sheet of tabular report data. */
export async function exportReportExcel(options: ReportExportOptions): Promise<void> {
  const { title, filename, headers, rows, subtitle, footerRows = [] } = options;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");

  ws.addRow([title]);
  if (subtitle) ws.addRow([subtitle]);
  ws.addRow([]);
  ws.addRow(headers);
  for (const row of rows) ws.addRow(row.map((c) => (c == null ? "" : c)));
  for (const row of footerRows) ws.addRow(row.map((c) => (c == null ? "" : c)));

  ws.columns = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => cellToString(r[i]).length),
      ...footerRows.map((r) => cellToString(r[i]).length),
      8
    );
    return { width: Math.min(Math.max(maxLen + 2, 10), 40) };
  });

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${sanitizeFilename(filename)}.xlsx`
  );
}

/** Download a PDF table report. */
export function exportReportPdf(options: ReportExportOptions): void {
  const { title, filename, headers, rows, subtitle, footerRows = [] } = options;
  const doc = new jsPDF({
    orientation: headers.length > 6 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  const marginX = 40;
  let y = 40;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, marginX, y);
  y += 18;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const meta = [subtitle, `Generated: ${new Date().toLocaleString()}`]
    .filter(Boolean)
    .join("  ·  ");
  if (meta) {
    doc.setTextColor(80);
    doc.text(meta, marginX, y);
    doc.setTextColor(0);
    y += 14;
  }

  const body = [
    ...rows.map((r) => r.map(cellToString)),
    ...footerRows.map((r) => r.map(cellToString)),
  ];

  autoTable(doc, {
    startY: y + 4,
    head: [headers],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: marginX, right: marginX },
  });

  doc.save(`${sanitizeFilename(filename)}.pdf`);
}
