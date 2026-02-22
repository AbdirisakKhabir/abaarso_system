import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateTotal, getGradeInfo } from "@/lib/grades";
import { isValidSemester } from "@/lib/semesters";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const courseId = searchParams.get("courseId");
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");

    const where: Record<string, unknown> = {};
    if (studentId) where.studentId = Number(studentId);
    if (courseId) where.courseId = Number(courseId);
    if (semester) where.semester = semester;
    if (year) where.year = Number(year);

    const records = await prisma.examRecord.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            departmentId: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            creditHours: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ year: "desc" }, { semester: "asc" }, { student: { firstName: "asc" } }],
    });

    return NextResponse.json(records);
  } catch (e) {
    console.error("Exam records list error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, courseId, semester, year, midExam, finalExam, assessment, project, assignment, presentation } = body;

    const parsedStudentId = Number(studentId);
    const parsedCourseId = Number(courseId);
    const parsedYear = Number(year);

    if (!Number.isInteger(parsedStudentId) || !Number.isInteger(parsedCourseId) || !semester || !Number.isInteger(parsedYear)) {
      return NextResponse.json({ error: "studentId, courseId, semester, and year are required" }, { status: 400 });
    }

    if (!(await isValidSemester(semester))) {
      return NextResponse.json({ error: "Invalid semester. Use a semester from the Semesters settings." }, { status: 400 });
    }

    // Validate marks are within range
    const marks = {
      midExam: Number(midExam || 0),
      finalExam: Number(finalExam || 0),
      assessment: Number(assessment || 0),
      project: Number(project || 0),
      assignment: Number(assignment || 0),
      presentation: Number(presentation || 0),
    };

    if (marks.midExam < 0 || marks.midExam > 20) return NextResponse.json({ error: "Mid Exam must be 0-20" }, { status: 400 });
    if (marks.finalExam < 0 || marks.finalExam > 40) return NextResponse.json({ error: "Final Exam must be 0-40" }, { status: 400 });
    if (marks.assessment < 0 || marks.assessment > 10) return NextResponse.json({ error: "Assessment must be 0-10" }, { status: 400 });
    if (marks.project < 0 || marks.project > 10) return NextResponse.json({ error: "Project must be 0-10" }, { status: 400 });
    if (marks.assignment < 0 || marks.assignment > 10) return NextResponse.json({ error: "Assignment must be 0-10" }, { status: 400 });
    if (marks.presentation < 0 || marks.presentation > 10) return NextResponse.json({ error: "Presentation must be 0-10" }, { status: 400 });

    const totalMarks = calculateTotal(marks);
    const { grade, gradePoints } = getGradeInfo(totalMarks);

    // Check for duplicate
    const existing = await prisma.examRecord.findUnique({
      where: {
        studentId_courseId_semester_year: {
          studentId: parsedStudentId,
          courseId: parsedCourseId,
          semester,
          year: parsedYear,
        },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Exam record for this student/course/semester/year already exists" }, { status: 400 });
    }

    const record = await prisma.examRecord.create({
      data: {
        studentId: parsedStudentId,
        courseId: parsedCourseId,
        semester,
        year: parsedYear,
        ...marks,
        totalMarks,
        grade,
        gradePoints,
      },
      include: {
        student: {
          select: { id: true, studentId: true, firstName: true, lastName: true, imageUrl: true },
        },
        course: {
          select: { id: true, name: true, code: true, creditHours: true },
        },
      },
    });

    return NextResponse.json(record);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Duplicate exam record for this student/course/semester/year" }, { status: 400 });
    }
    console.error("Create exam record error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
