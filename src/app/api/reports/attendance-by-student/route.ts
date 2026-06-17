import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAttendanceMarks,
  computeAttendancePercent,
} from "@/lib/attendance";
import { getSemesterDateRange } from "@/lib/semester-dates";

/**
 * GET /api/reports/attendance-by-student
 * Supports filters: departmentId, classId, courseId, studentId, dateFrom, dateTo.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const courseId = searchParams.get("courseId");
    const studentId = searchParams.get("studentId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const semesterParam = searchParams.get("semester");
    const yearParam = searchParams.get("year");

    const parsedDepartmentId =
      departmentId && Number.isInteger(Number(departmentId))
        ? Number(departmentId)
        : null;
    const parsedClassId =
      classId && Number.isInteger(Number(classId)) ? Number(classId) : null;
    const parsedCourseId =
      courseId && Number.isInteger(Number(courseId)) ? Number(courseId) : null;
    const parsedStudentId =
      studentId && Number.isInteger(Number(studentId)) ? Number(studentId) : null;

    let cls: {
      id: number;
      name: string;
      semester: string;
      year: number;
      department: { id: number; name: string; code: string };
    } | null = null;

    if (parsedClassId) {
      const classRow = await prisma.class.findUnique({
        where: { id: parsedClassId },
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
      });
      if (!classRow) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }
      cls = classRow;
    }

    const semester = semesterParam ?? cls?.semester ?? null;
    const year = yearParam
      ? Number(yearParam)
      : cls?.year ?? new Date().getFullYear();

    const sessionDateWhere: { gte?: Date; lte?: Date } = {};
    if (dateFrom || dateTo) {
      if (dateFrom) sessionDateWhere.gte = new Date(dateFrom);
      if (dateTo) sessionDateWhere.lte = new Date(dateTo);
    } else if (semester) {
      const { start, end } = getSemesterDateRange(semester, year);
      sessionDateWhere.gte = start;
      sessionDateWhere.lte = end;
    }

    const sessionsOrdered = await prisma.attendanceSession.findMany({
      where: {
        ...(parsedClassId ? { classId: parsedClassId } : {}),
        ...(parsedCourseId ? { courseId: parsedCourseId } : {}),
        ...(parsedDepartmentId
          ? { class: { departmentId: parsedDepartmentId } }
          : {}),
        date: sessionDateWhere,
      },
      orderBy: [{ date: "asc" }, { shift: "asc" }],
      select: { id: true },
    });
    const sessionIds = sessionsOrdered.map((s) => s.id);
    const totalSessions = sessionIds.length;

    const students = await prisma.student.findMany({
      where: {
        status: "Admitted",
        ...(parsedStudentId ? { id: parsedStudentId } : {}),
        ...(parsedClassId ? { classId: parsedClassId } : {}),
        ...(parsedDepartmentId ? { departmentId: parsedDepartmentId } : {}),
      },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    if (students.length === 0) {
      return NextResponse.json({
        class: cls,
        semester,
        year,
        students: [],
        totalSessions: 0,
        sheet: null,
      });
    }

    const records =
      sessionIds.length > 0
        ? await prisma.attendanceRecord.findMany({
            where: {
              sessionId: { in: sessionIds },
              studentId: { in: students.map((s) => s.id) },
            },
            select: { sessionId: true, studentId: true, status: true },
          })
        : [];

    const byStudent = new Map<
      number,
      { present: number; absent: number; late: number; excused: number }
    >();
    for (const s of students) {
      byStudent.set(s.id, { present: 0, absent: 0, late: 0, excused: 0 });
    }
    for (const r of records) {
      const agg = byStudent.get(r.studentId);
      if (!agg) continue;
      if (r.status === "Present") agg.present++;
      else if (r.status === "Absent") agg.absent++;
      else if (r.status === "Late") agg.late++;
      else if (r.status === "Excused") agg.excused++;
    }

    const result = students.map((s) => {
      const agg = byStudent.get(s.id) ?? {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
      const presentPlusExcused = agg.present + agg.excused;
      const attendancePercent = computeAttendancePercent(
        presentPlusExcused,
        totalSessions
      );
      const attendanceMarks = computeAttendanceMarks(
        presentPlusExcused,
        totalSessions
      );

      return {
        studentId: s.id,
        studentIdStr: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        present: agg.present,
        absent: agg.absent,
        late: agg.late,
        excused: agg.excused,
        totalSessions,
        attendancePercent,
        attendanceMarks,
        rowDanger: attendancePercent < 35,
      };
    });

    return NextResponse.json({
      class: cls,
      semester,
      year,
      students: result,
      totalSessions,
      sheet: null,
    });
  } catch (e) {
    console.error("Attendance-by-student report error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
