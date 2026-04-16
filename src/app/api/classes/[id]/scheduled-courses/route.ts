import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/classes/[id]/scheduled-courses
 * Distinct courses on the class timetable for the class's semester/year (for attendance / reports).
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid class ID" }, { status: 400 });
    }

    const cls = await prisma.class.findUnique({
      where: { id },
      select: { id: true, semester: true, year: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const rows = await prisma.classSchedule.findMany({
      where: {
        classId: id,
        semester: cls.semester,
        year: cls.year,
      },
      include: {
        course: { select: { id: true, code: true, name: true } },
        lecturer: { select: { id: true, name: true } },
      },
      orderBy: [{ courseId: "asc" }],
    });

    const seen = new Set<number>();
    const courses = [];
    for (const r of rows) {
      if (seen.has(r.courseId)) continue;
      seen.add(r.courseId);
      courses.push({
        scheduleId: r.id,
        course: r.course,
        lecturer: r.lecturer,
        dayOfWeek: r.dayOfWeek,
        shift: r.shift,
        startTime: r.startTime,
        endTime: r.endTime,
      });
    }

    return NextResponse.json({ class: cls, courses });
  } catch (e) {
    console.error("scheduled-courses error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
