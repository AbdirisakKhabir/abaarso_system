import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { buildStudentAcademicReport } from "@/lib/studentAcademicReport";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const parsed = Number(studentId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
    }

    const report = await buildStudentAcademicReport(parsed, "all");
    if (!report) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({
      student: report.student,
      records: report.records,
      gpa: report.gpa,
      semesterSortMap: report.semesterSortMap,
    });
  } catch (e) {
    console.error("GPA calculation error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
