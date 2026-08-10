import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workbookBufferFromAoa } from "@/lib/excel";
import { computeAttendanceMarks } from "@/lib/attendance";
import { getSemesterDateRange } from "@/lib/semester-dates";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const courseId = searchParams.get("courseId");
    if (!classId || !courseId) {
      return NextResponse.json(
        { error: "classId and courseId are required to download template" },
        { status: 400 }
      );
    }

    const cls = await prisma.class.findUnique({
      where: { id: Number(classId) },
      include: { department: { select: { id: true, name: true, code: true } } },
    });

    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const course = await prisma.course.findUnique({
      where: { id: Number(courseId) },
    });
    if (!course || course.departmentId !== cls.departmentId) {
      return NextResponse.json(
        { error: "Course not found or does not belong to the class's department" },
        { status: 400 }
      );
    }

    const students = await prisma.student.findMany({
      where: { classId: Number(classId), status: "Admitted" },
      select: { id: true, studentId: true, firstName: true, lastName: true },
      orderBy: [{ studentId: "asc" }],
    });

    const { start, end } = getSemesterDateRange(cls.semester, cls.year);
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        classId: Number(classId),
        courseId: Number(courseId),
        date: { gte: start, lte: end },
      },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    const totalSessions = sessionIds.length;
    const attendanceRecords =
      totalSessions > 0
        ? await prisma.attendanceRecord.findMany({
            where: {
              sessionId: { in: sessionIds },
              studentId: { in: students.map((s) => s.id) },
            },
            select: { studentId: true, status: true },
          })
        : [];
    const byStudent = new Map<number, number>();
    for (const s of students) byStudent.set(s.id, 0);
    for (const r of attendanceRecords) {
      if (r.status === "Present" || r.status === "Excused") {
        byStudent.set(r.studentId, (byStudent.get(r.studentId) ?? 0) + 1);
      }
    }

    const headers = [
      "S/No",
      "ID Card",
      "Student's Name",
      "Mid Term",
      "Assignment2",
      "Assignment1",
      "final",
      "Attendance",
      "Total",
      "Grade",
      "GPA",
    ];

    const rows = students.map((s, idx) => {
      const presentPlusExcused = byStudent.get(s.id) ?? 0;
      const attendanceMarks = computeAttendanceMarks(presentPlusExcused, totalSessions);
      return [
        idx + 1,
        s.studentId,
        `${s.firstName} ${s.lastName}`,
        "",
        "",
        "",
        "",
        totalSessions > 0 ? attendanceMarks.toFixed(2) : "",
        "",
        "",
        "",
      ];
    });

    const buf = await workbookBufferFromAoa({
      sheetName: `Exam ${course.code} ${cls.semester} ${cls.year}`,
      rows: [headers, ...rows],
      columnWidths: [6, 14, 28, 10, 12, 12, 8, 12, 8, 6, 6],
    });
    const filename = `Exam_Template_${course.code}_${cls.name}_${cls.semester}_${cls.year}.xlsx`;

    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("Template download error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
