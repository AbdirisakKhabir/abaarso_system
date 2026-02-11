import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: { classId?: number; class?: { course?: { departmentId?: number } }; date?: { gte?: Date; lte?: Date } } = {};

    if (departmentId) {
      where.class = { course: { departmentId: Number(departmentId) } };
    }
    if (classId) {
      where.classId = Number(classId);
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            semester: true,
            year: true,
            course: {
              select: { id: true, name: true, code: true, department: { select: { id: true, name: true, code: true } } },
            },
          },
        },
        takenBy: { select: { id: true, name: true, email: true } },
        records: { select: { status: true } },
      },
      orderBy: [{ date: "desc" }, { shift: "asc" }],
    });

    const summary = {
      totalSessions: sessions.length,
      totalPresent: 0,
      totalAbsent: 0,
      totalLate: 0,
      totalExcused: 0,
    };

    const enriched = sessions.map((s) => {
      const present = s.records.filter((r) => r.status === "Present").length;
      const absent = s.records.filter((r) => r.status === "Absent").length;
      const late = s.records.filter((r) => r.status === "Late").length;
      const excused = s.records.filter((r) => r.status === "Excused").length;
      summary.totalPresent += present;
      summary.totalAbsent += absent;
      summary.totalLate += late;
      summary.totalExcused += excused;
      return {
        id: s.id,
        class: s.class,
        date: s.date,
        shift: s.shift,
        takenBy: s.takenBy,
        takenAt: s.takenAt,
        present,
        absent,
        late,
        excused,
        total: s.records.length,
      };
    });

    return NextResponse.json({
      sessions: enriched,
      summary,
    });
  } catch (e) {
    console.error("Attendance report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
