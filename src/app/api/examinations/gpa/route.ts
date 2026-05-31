import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  buildStudentAcademicReport,
  resolveStudentInternalId,
} from "@/lib/studentAcademicReport";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("studentId")?.trim();

    if (!raw) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const asNum = Number(raw);
    let internalId: number | null =
      Number.isInteger(asNum) && asNum > 0 ? asNum : null;
    if (internalId == null) {
      internalId = await resolveStudentInternalId(raw);
    }
    if (internalId == null) {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
    }

    const report = await buildStudentAcademicReport(internalId, "all");
    if (!report) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const records = report.records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      courseId: r.courseId,
      semester: r.semester,
      year: r.year,
      midExam: r.midExam,
      finalExam: r.finalExam,
      assessment: r.assessment,
      project: r.project,
      assignment: r.assignment,
      presentation: r.presentation,
      totalMarks: Number(r.totalMarks),
      grade: r.grade,
      gradePoints: r.gradePoints != null ? Number(r.gradePoints) : null,
      status: r.status,
      course: {
        id: r.course.id,
        name: r.course.name,
        code: r.course.code,
        creditHours: r.course.creditHours,
      },
    }));

    return NextResponse.json({
      student: report.student,
      records,
      gpa: report.gpa,
      semesterSortMap: report.semesterSortMap,
    });
  } catch (e) {
    console.error("GPA calculation error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
