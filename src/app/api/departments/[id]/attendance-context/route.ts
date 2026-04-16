import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/departments/[id]/attendance-context
 * Active classes in the department, department courses, and active semesters — for attendance UI.
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
      return NextResponse.json({ error: "Invalid department ID" }, { status: 400 });
    }

    const department = await prisma.department.findFirst({
      where: { id, isActive: true },
      select: { id: true, name: true, code: true },
    });
    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const [courses, semesters, classes] = await Promise.all([
      prisma.course.findMany({
        where: { departmentId: id, isActive: true },
        select: { id: true, code: true, name: true, creditHours: true },
        orderBy: [{ code: "asc" }],
      }),
      prisma.semester.findMany({
        where: { isActive: true },
        select: { id: true, name: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.class.findMany({
        where: { departmentId: id, isActive: true },
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ year: "desc" }, { semester: "asc" }, { name: "asc" }],
      }),
    ]);

    return NextResponse.json({ department, courses, semesters, classes });
  } catch (e) {
    console.error("attendance-context error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
