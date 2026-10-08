import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAttendanceMarks,
  computeAttendancePercent,
} from "@/lib/attendance";
import { getSemesterDateRange } from "@/lib/semester-dates";
import { parseProgram } from "@/lib/program";
import { classRosterStudentWhere } from "@/lib/class-roster";

/**
 * GET /api/reports/attendance-by-student
 * Supports filters: departmentId, classId, courseId, studentId, search, dateFrom, dateTo, program.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const program = parseProgram(searchParams.get("program")) as "Bachelor" | "Masters";
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const courseId = searchParams.get("courseId");
    const studentId = searchParams.get("studentId");
    const search = searchParams.get("search")?.trim() || "";
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
      if (classRow.program !== program) {
        return NextResponse.json(
          { error: "Selected class does not belong to the chosen program" },
          { status: 400 }
        );
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
    } else if (semesterParam && !parsedClassId) {
      // A class already scopes sessions to its own term, so only an explicit
      // semester without a class falls back to a calendar range.
      const { start, end } = getSemesterDateRange(semesterParam, year);
      sessionDateWhere.gte = start;
      sessionDateWhere.lte = end;
    }

    const sessionsOrdered = await prisma.attendanceSession.findMany({
      where: {
        ...(parsedClassId ? { classId: parsedClassId } : {}),
        ...(parsedCourseId ? { courseId: parsedCourseId } : {}),
        class: {
          program,
          ...(parsedDepartmentId ? { departmentId: parsedDepartmentId } : {}),
        },
        ...(Object.keys(sessionDateWhere).length > 0
          ? { date: sessionDateWhere }
          : {}),
      },
      orderBy: [{ date: "asc" }, { shift: "asc" }],
      select: {
        id: true,
        courseId: true,
        course: { select: { id: true, code: true, name: true } },
      },
    });
    const sessionIds = sessionsOrdered.map((s) => s.id);

    const courseMap = new Map<
      number,
      { courseId: number; code: string; name: string; sessionCount: number }
    >();
    for (const s of sessionsOrdered) {
      if (!s.course) continue;
      const existing = courseMap.get(s.course.id);
      if (existing) existing.sessionCount += 1;
      else {
        courseMap.set(s.course.id, {
          courseId: s.course.id,
          code: s.course.code,
          name: s.course.name,
          sessionCount: 1,
        });
      }
    }
    const courseSessions = [...courseMap.values()].sort(
      (a, b) => b.sessionCount - a.sessionCount || a.code.localeCompare(b.code)
    );

    const rosterWhere = parsedClassId
      ? await classRosterStudentWhere(parsedClassId)
      : null;
    const students = await prisma.student.findMany({
      where: {
        status: { in: ["Admitted", "Graduated"] },
        program,
        ...(parsedStudentId ? { id: parsedStudentId } : {}),
        ...(rosterWhere ?? {}),
        ...(parsedDepartmentId && !parsedClassId ? { departmentId: parsedDepartmentId } : {}),
        ...(search && !parsedStudentId
          ? {
              OR: [
                { studentId: { contains: search } },
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        phone: true,
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
        courseSessions,
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
      {
        present: number;
        absent: number;
        late: number;
        excused: number;
        sessionIds: Set<number>;
      }
    >();
    for (const s of students) {
      byStudent.set(s.id, {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        sessionIds: new Set(),
      });
    }
    for (const r of records) {
      const agg = byStudent.get(r.studentId);
      if (!agg) continue;
      agg.sessionIds.add(r.sessionId);
      if (r.status === "Present") agg.present++;
      else if (r.status === "Absent") agg.absent++;
      else if (r.status === "Late") agg.late++;
      else if (r.status === "Excused") agg.excused++;
    }

    const result = students
      .map((s) => {
        const agg = byStudent.get(s.id) ?? {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          sessionIds: new Set<number>(),
        };
        const studentTotalSessions = agg.sessionIds.size;
        const presentPlusExcused = agg.present + agg.excused;
        const attendancePercent = computeAttendancePercent(
          presentPlusExcused,
          studentTotalSessions
        );
        const attendanceMarks = computeAttendanceMarks(
          presentPlusExcused,
          studentTotalSessions
        );

        return {
          studentId: s.id,
          studentIdStr: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          phone: s.phone,
          present: agg.present,
          absent: agg.absent,
          late: agg.late,
          excused: agg.excused,
          totalSessions: studentTotalSessions,
          attendancePercent,
          attendanceMarks,
          rowDanger: attendancePercent < 35,
        };
      })
      // When searching, only show students who actually have attendance in range
      .filter((s) => (search ? s.totalSessions > 0 : true));

    const maxStudentSessions = result.reduce(
      (max, s) => Math.max(max, s.totalSessions),
      0
    );

    return NextResponse.json({
      class: cls,
      semester,
      year,
      students: result,
      totalSessions: maxStudentSessions,
      courseSessions,
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
