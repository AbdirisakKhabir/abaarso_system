import ExcelJS from "exceljs";

export type ExcelCell = string | number | boolean | null | undefined | Date;

/** Build an .xlsx buffer from a sheet of row arrays (AOA). */
export async function workbookBufferFromAoa(options: {
  sheetName: string;
  rows: ExcelCell[][];
  columnWidths?: number[];
}): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(options.sheetName.slice(0, 31) || "Sheet1");

  for (const row of options.rows) {
    ws.addRow(row.map((c) => (c == null ? "" : c)));
  }

  if (options.columnWidths?.length) {
    ws.columns = options.columnWidths.map((w) => ({ width: w }));
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

/** Read first worksheet as array-of-arrays (like sheet_to_json header:1). */
export async function readWorkbookAoa(
  input: Buffer | ArrayBuffer | Uint8Array
): Promise<(string | number | boolean | Date | null)[][]> {
  const wb = new ExcelJS.Workbook();
  const bytes =
    input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : Buffer.isBuffer(input)
        ? Uint8Array.from(input)
        : input;
  // exceljs accepts ArrayBuffer-like inputs at runtime
  await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const rows: (string | number | boolean | Date | null)[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: (string | number | boolean | Date | null)[] = [];
    const maxCol = Math.max(row.cellCount, 1);
    for (let c = 1; c <= maxCol; c++) {
      cells.push(normalizeCell(row.getCell(c).value));
    }
    rows.push(cells);
  });
  return rows;
}

function normalizeCell(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("");
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("result" in value && value.result != null) {
      return normalizeCell(value.result as ExcelJS.CellValue);
    }
    if ("hyperlink" in value && "text" in value) {
      return String((value as { text?: string }).text ?? "");
    }
  }
  return String(value);
}
