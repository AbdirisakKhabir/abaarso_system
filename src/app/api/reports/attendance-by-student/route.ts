import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAttendanceMarks,
  computeAttendancePercent,
} from "@/lib/attendance";
import { getSemesterDateRange } from "@/lib/semester-dates";

/**
 * GET /api/reports/attendance-by-student?classId=X&semester=Y&year=Z
 * Returns per-student attendance for a class: Present, Absent, Late, Excused,
 * attendance %, and attendance marks (0-10) for exam integration.
 * If semester and year are omitted, uses the class's semester/year.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const semesterParam = searchParams.get("semester");
    const yearParam = searchParams.get("year");

    if (!classId) {
      return NextResponse.json(
        { error: "classId is required for attendance-by-student report" },
        { status: 400 }
      );
    }

    const cls = await prisma.class.findUnique({
      where: { id: Number(classId) },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const semester = semesterParam ?? cls.semester;
    const year = yearParam ? Number(yearParam) : cls.year;
    const { start, end } = getSemesterDateRange(semester, year);

    // Get attendance sessions for this class within the semester date range
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        classId: Number(classId),
        date: { gte: start, lte: end },
      },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    const totalSessions = sessionIds.length;

    // Get all students in this class (from Student.classId)
    const students = await prisma.student.findMany({
      where: { classId: Number(classId), status: "Admitted" },
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
        students: [],
        totalSessions: 0,
      });
    }

    // Get all attendance records for these students in these sessions
    const records = await prisma.attendanceRecord.findMany({
      where: {
        sessionId: { in: sessionIds },
        studentId: { in: students.map((s) => s.id) },
      },
      select: { sessionId: true, studentId: true, status: true },
    });

    // Aggregate by student
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
      };
    });

    return NextResponse.json({
      class: cls,
      semester,
      year,
      students: result,
      totalSessions,
    });
  } catch (e) {
    console.error("Attendance-by-student report error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
