import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/courses/bulk-delete
 * Body: { ids?: number[], departmentId?: number }
 * Deletes courses by IDs or by department. Only deletes courses with no schedule slots.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ids, departmentId } = body as {
      ids?: number[];
      departmentId?: number;
    };

    let courseIds: number[];

    if (ids && Array.isArray(ids) && ids.length > 0) {
      courseIds = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id));
    } else if (departmentId != null && Number.isInteger(Number(departmentId))) {
      const courses = await prisma.course.findMany({
        where: { departmentId: Number(departmentId) },
        select: { id: true },
      });
      courseIds = courses.map((c) => c.id);
    } else {
      return NextResponse.json(
        { error: "Provide ids (array of course IDs) or departmentId" },
        { status: 400 }
      );
    }

    if (courseIds.length === 0) {
      return NextResponse.json({
        deleted: 0,
        skipped: 0,
        errors: ["No valid courses to delete"],
      });
    }

    const deleted: number[] = [];
    const errors: string[] = [];

    for (const id of courseIds) {
      const count = await prisma.classSchedule.count({ where: { courseId: id } });
      if (count > 0) {
        const course = await prisma.course.findUnique({
          where: { id },
          select: { code: true },
        });
        errors.push(`Course ${course?.code ?? id} has schedule slots and cannot be deleted`);
        continue;
      }
      await prisma.course.delete({ where: { id } });
      deleted.push(id);
    }

    return NextResponse.json({
      deleted: deleted.length,
      skipped: courseIds.length - deleted.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("Bulk delete courses error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
