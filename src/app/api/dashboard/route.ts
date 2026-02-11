import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      usersCount,
      studentsCount,
      admittedCount,
      rolesCount,
      facultiesCount,
      departmentsCount,
      coursesCount,
      classesCount,
      attendanceCount,
      examRecordsCount,
      recentStudents,
      recentAttendance,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.student.count(),
      prisma.student.count({ where: { status: "Admitted" } }),
      prisma.role.count(),
      prisma.faculty.count({ where: { isActive: true } }),
      prisma.department.count({ where: { isActive: true } }),
      prisma.course.count({ where: { isActive: true } }),
      prisma.class.count({ where: { isActive: true } }),
      prisma.attendanceSession.count(),
      prisma.examRecord.count(),
      prisma.student.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          status: true,
          admissionDate: true,
          department: { select: { name: true, code: true } },
        },
      }),
      prisma.attendanceSession.findMany({
        take: 5,
        orderBy: { takenAt: "desc" },
        include: {
          class: {
            select: {
              name: true,
              course: { select: { code: true, name: true } },
            },
          },
          takenBy: { select: { name: true } },
          _count: { select: { records: true } },
          records: { select: { status: true } },
        },
      }),
    ]);

    const studentsByStatus = await prisma.student.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const studentsByDepartment = await prisma.student.groupBy({
      by: ["departmentId"],
      _count: { id: true },
      where: { status: "Admitted" },
    });

    const deptIds = studentsByDepartment.map((d) => d.departmentId);
    const departments = deptIds.length
      ? await prisma.department.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true, code: true },
        })
      : [];

    const deptMap = Object.fromEntries(departments.map((d) => [d.id, d]));

    return NextResponse.json({
      counts: {
        users: usersCount,
        students: studentsCount,
        admitted: admittedCount,
        roles: rolesCount,
        faculties: facultiesCount,
        departments: departmentsCount,
        courses: coursesCount,
        classes: classesCount,
        attendance: attendanceCount,
        examRecords: examRecordsCount,
      },
      recentStudents,
      recentAttendance: recentAttendance.map((s) => ({
        id: s.id,
        class: s.class,
        date: s.date,
        shift: s.shift,
        takenBy: s.takenBy,
        totalRecords: s._count.records,
        present: s.records.filter((r) => r.status === "Present").length,
        absent: s.records.filter((r) => r.status === "Absent").length,
        late: s.records.filter((r) => r.status === "Late").length,
        excused: s.records.filter((r) => r.status === "Excused").length,
        takenAt: s.takenAt,
      })),
      studentsByStatus: studentsByStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      studentsByDepartment: studentsByDepartment.map((d) => ({
        departmentId: d.departmentId,
        department: deptMap[d.departmentId],
        count: d._count.id,
      })),
    });
  } catch (e) {
    console.error("Dashboard stats error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
