import { NextRequest, NextResponse } from "next/server";
import {
  buildStudentAcademicReport,
  resolveStudentInternalId,
} from "@/lib/studentAcademicReport";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "private, max-age=60",
  };
}

/**
 * Public read-only report: examination rows + transcript GPA for a student.
 * Query: studentId — institutional ID (e.g. STD-2026-0001) or numeric internal id.
 * Only Admitted / Graduated students. Only approved exam rows.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw =
      searchParams.get("studentId")?.trim() ||
      searchParams.get("id")?.trim() ||
      "";

    if (!raw) {
      return NextResponse.json(
        {
          error:
            "Missing studentId. Example: /api/public/student-academic-report?studentId=STD-2026-0001",
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    const internalId = await resolveStudentInternalId(raw);
    if (internalId == null) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    const report = await buildStudentAcademicReport(internalId, "approved");
    if (!report) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    const { student, records, gpa, semesterSortMap } = report;

    return NextResponse.json(
      {
        student: {
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          admissionDate: student.admissionDate,
          department: student.department,
        },
        examinationRecords: records.map((r) => ({
          id: r.id,
          semester: r.semester,
          year: r.year,
          midExam: r.midExam,
          finalExam: r.finalExam,
          assessment: r.assessment,
          project: r.project,
          assignment: r.assignment,
          presentation: r.presentation,
          totalMarks: r.totalMarks,
          grade: r.grade,
          gradePoints: r.gradePoints,
          course: r.course,
        })),
        transcript: {
          cumulativeGPA: gpa.cumulativeGPA,
          totalCredits: gpa.totalCredits,
          semesters: gpa.semesters,
        },
        semesterSortMap,
      },
      { headers: corsHeaders() }
    );
  } catch (e) {
    console.error("Public student academic report error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
