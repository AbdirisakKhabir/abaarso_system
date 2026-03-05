import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAttendanceMarks,
  computeAttendancePercent,
} from "@/lib/attendance";
import { getSemesterDateRange } from "@/lib/semester-dates";

/**
 * GET /api/reports/attendance-exam?classId=X&courseId=Y
 * Returns students with attendance (Present, Absent, Late, Excused, %, marks) and exam records
 * for the selected class and course. Attendance is filtered by class semester/year.
 * courseId is optional - if provided, includes exam record for that course only.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const courseId = searchParams.get("courseId");

    if (!classId) {
      return NextResponse.json(
        { error: "classId is required" },
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

    const students = await prisma.student.findMany({
      where: { classId: Number(classId), status: "Admitted" },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [{ studentId: "asc" }],
    });

    const studentIds = students.map((s) => s.id);

    // Attendance (semester-filtered)
    const { start, end } = getSemesterDateRange(cls.semester, cls.year);
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        classId: Number(classId),
        date: { gte: start, lte: end },
      },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    const totalSessions = sessionIds.length;

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        sessionId: { in: sessionIds },
        studentId: { in: studentIds },
      },
      select: { sessionId: true, studentId: true, status: true },
    });

    const byStudent = new Map<
      number,
      { present: number; absent: number; late: number; excused: number }
    >();
    for (const s of students) {
      byStudent.set(s.id, { present: 0, absent: 0, late: 0, excused: 0 });
    }
    for (const r of attendanceRecords) {
      const agg = byStudent.get(r.studentId);
      if (!agg) continue;
      if (r.status === "Present") agg.present++;
      else if (r.status === "Absent") agg.absent++;
      else if (r.status === "Late") agg.late++;
      else if (r.status === "Excused") agg.excused++;
    }

    // Exam records - optionally filtered by course
    const examWhere: {
      studentId: { in: number[] };
      semester: string;
      year: number;
      courseId?: number;
    } = {
      studentId: { in: studentIds },
      semester: cls.semester,
      year: cls.year,
    };
    if (courseId) {
      examWhere.courseId = Number(courseId);
    }

    const examRecords = await prisma.examRecord.findMany({
      where: examWhere,
      include: {
        course: { select: { id: true, code: true, name: true } },
      },
    });

    const examsByStudent = new Map<number, typeof examRecords>();
    for (const er of examRecords) {
      if (!examsByStudent.has(er.studentId)) {
        examsByStudent.set(er.studentId, []);
      }
      examsByStudent.get(er.studentId)!.push(er);
    }

    const courses = courseId
      ? await prisma.course.findMany({
          where: { id: Number(courseId) },
          select: { id: true, code: true, name: true },
        })
      : await prisma.course.findMany({
          where: { departmentId: cls.departmentId },
          select: { id: true, code: true, name: true },
          orderBy: [{ code: "asc" }],
        });

    const rows = students.map((s) => {
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
      const exams = examsByStudent.get(s.id) ?? [];

      return {
        student: {
          id: s.id,
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
        },
        attendance: {
          present: agg.present,
          absent: agg.absent,
          late: agg.late,
          excused: agg.excused,
          totalSessions,
          attendancePercent,
          attendanceMarks,
        },
        examRecords: exams.map((e) => ({
          courseId: e.courseId,
          courseCode: e.course.code,
          courseName: e.course.name,
          midExam: e.midExam ?? 0,
          finalExam: e.finalExam ?? 0,
          assessment: e.assessment ?? 0,
          project: e.project ?? 0,
          assignment: e.assignment ?? 0,
          presentation: e.presentation ?? 0,
          totalMarks: e.totalMarks ?? 0,
          grade: e.grade ?? "",
          gradePoints: e.gradePoints ?? 0,
        })),
      };
    });

    return NextResponse.json({
      class: cls,
      semester: cls.semester,
      year: cls.year,
      totalSessions,
      courses,
      rows,
    });
  } catch (e) {
    console.error("Attendance-exam report error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
