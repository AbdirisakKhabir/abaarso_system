import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ courseId: string }> };

/** GET lecturers assigned to a specific course (for schedule validation) */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId: rawId } = await ctx.params;
    const courseId = Number(rawId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
    }

    const lecturers = await prisma.lecturer.findMany({
      where: {
        isActive: true,
        courses: { some: { courseId } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(lecturers);
  } catch (e) {
    console.error("Lecturers by course error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
