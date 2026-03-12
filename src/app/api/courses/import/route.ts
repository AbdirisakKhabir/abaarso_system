import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function findCol(headerRow: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const idx = headerRow.findIndex((h) => p.test(String(h).trim()));
    if (idx >= 0) return idx;
  }
  return -1;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const departmentIdStr = formData.get("departmentId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "file is required" },
        { status: 400 }
      );
    }

    const departmentId = departmentIdStr ? Number(departmentIdStr) : NaN;
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return NextResponse.json(
        { error: "departmentId is required and must be a valid department" },
        { status: 400 }
      );
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as (string | number)[][];

    if (!data || data.length < 2) {
      return NextResponse.json(
        { error: "Excel file must have a header row and at least one course row" },
        { status: 400 }
      );
    }

    const headerRow = (data[0] as string[]).map((h) => String(h ?? "").trim());

    const nameIdx = findCol(headerRow, [/^course\s*name$/i, /^name$/i, /^course$/i]);
    const codeIdx = findCol(headerRow, [/^code$/i]);
    const creditHoursIdx = findCol(headerRow, [/^credit\s*hours$/i, /^credits$/i, /^credit$/i]);
    const descriptionIdx = findCol(headerRow, [/^description$/i, /^desc$/i]);

    if (nameIdx < 0 || codeIdx < 0) {
      return NextResponse.json(
        { error: "Excel must contain 'Course Name' and 'Code' columns" },
        { status: 400 }
      );
    }

    const created: number[] = [];
    const errors: string[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as (string | number)[];
      if (!row || row.length === 0) continue;

      const name = String(row[nameIdx] ?? "").trim();
      const code = String(row[codeIdx] ?? "").trim().toUpperCase();
      if (!name || !code) {
        errors.push(`Row ${i + 1}: Course name and code are required`);
        continue;
      }

      const creditHours =
        creditHoursIdx >= 0 && row[creditHoursIdx] !== undefined && row[creditHoursIdx] !== ""
          ? Math.max(1, Math.min(12, Number(row[creditHoursIdx]) || 3))
          : 3;
      const description =
        descriptionIdx >= 0 ? String(row[descriptionIdx] ?? "").trim() || null : null;

      const existing = await prisma.course.findFirst({
        where: { OR: [{ name }, { code }] },
      });
      if (existing) {
        errors.push(`Row ${i + 1}: Course "${code}" or "${name}" already exists`);
        continue;
      }

      const course = await prisma.course.create({
        data: {
          name,
          code,
          description,
          creditHours: Number.isInteger(creditHours) ? creditHours : 3,
          departmentId,
        },
      });
      created.push(course.id);
    }

    return NextResponse.json({
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("Course import error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
