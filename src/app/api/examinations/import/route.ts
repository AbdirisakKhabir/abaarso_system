import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { calculateTotal, getGradeInfo } from "@/lib/grades";

const HEADERS = [
  "Student ID",
  "First Name",
  "Last Name",
  "Mid Exam (/20)",
  "Final Exam (/40)",
  "Assessment (/10)",
  "Project (/10)",
  "Assignment (/10)",
  "Presentation (/10)",
];

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const classId = formData.get("classId") as string | null;

    if (!file || !classId) {
      return NextResponse.json(
        { error: "file and classId are required" },
        { status: 400 }
      );
    }

    const cls = await prisma.class.findUnique({
      where: { id: Number(classId) },
      select: { id: true, courseId: true, semester: true, year: true, course: { select: { code: true, name: true } } },
    });

    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as (string | number)[][];

    if (!data || data.length < 2) {
      return NextResponse.json(
        { error: "Excel file must have a header row and at least one student row" },
        { status: 400 }
      );
    }

    const headerRow = data[0] as string[];
    const midIdx = headerRow.findIndex((h) => /mid/i.test(String(h)));
    const finalIdx = headerRow.findIndex((h) => /final/i.test(String(h)));
    const assessIdx = headerRow.findIndex((h) => /assessment/i.test(String(h)));
    const projectIdx = headerRow.findIndex((h) => /project/i.test(String(h)));
    const assignIdx = headerRow.findIndex((h) => /assignment/i.test(String(h)));
    const presentIdx = headerRow.findIndex((h) => /presentation/i.test(String(h)));
    const studentIdIdx = headerRow.findIndex((h) => /student\s*id/i.test(String(h)));

    if (studentIdIdx < 0) {
      return NextResponse.json(
        { error: "Excel must contain a 'Student ID' column" },
        { status: 400 }
      );
    }

    const created: number[] = [];
    const updated: number[] = [];
    const errors: string[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as (string | number)[];
      if (!row || row.length === 0) continue;

      const studentIdStr = String(row[studentIdIdx] ?? "").trim();
      if (!studentIdStr) continue;

      const student = await prisma.student.findUnique({
        where: { studentId: studentIdStr },
        select: { id: true },
      });

      if (!student) {
        errors.push(`Row ${i + 1}: Student "${studentIdStr}" not found`);
        continue;
      }

      const mid = parseNum(row[midIdx]);
      const final = parseNum(row[finalIdx]);
      const assess = parseNum(row[assessIdx]);
      const project = parseNum(row[projectIdx]);
      const assign = parseNum(row[assignIdx]);
      const present = parseNum(row[presentIdx]);

      if (mid < 0 || mid > 20) {
        errors.push(`Row ${i + 1}: Mid Exam must be 0-20`);
        continue;
      }
      if (final < 0 || final > 40) {
        errors.push(`Row ${i + 1}: Final Exam must be 0-40`);
        continue;
      }
      if (assess < 0 || assess > 10 || project < 0 || project > 10 || assign < 0 || assign > 10 || present < 0 || present > 10) {
        errors.push(`Row ${i + 1}: Assessment, Project, Assignment, Presentation must be 0-10`);
        continue;
      }

      const marks = {
        midExam: mid,
        finalExam: final,
        assessment: assess,
        project,
        assignment: assign,
        presentation: present,
      };
      const totalMarks = calculateTotal(marks);
      const { grade, gradePoints } = getGradeInfo(totalMarks);

      const existing = await prisma.examRecord.findUnique({
        where: {
          studentId_courseId_semester_year: {
            studentId: student.id,
            courseId: cls.courseId,
            semester: cls.semester,
            year: cls.year,
          },
        },
      });

      if (existing) {
        await prisma.examRecord.update({
          where: { id: existing.id },
          data: { ...marks, totalMarks, grade, gradePoints },
        });
        updated.push(existing.id);
      } else {
        const rec = await prisma.examRecord.create({
          data: {
            studentId: student.id,
            courseId: cls.courseId,
            semester: cls.semester,
            year: cls.year,
            ...marks,
            totalMarks,
            grade,
            gradePoints,
          },
        });
        created.push(rec.id);
      }
    }

    return NextResponse.json({
      created: created.length,
      updated: updated.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("Exam import error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function parseNum(val: string | number | undefined): number {
  if (val === undefined || val === null || val === "") return 0;
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}
