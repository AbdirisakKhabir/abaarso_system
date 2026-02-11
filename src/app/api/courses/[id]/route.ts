import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        classes: {
          select: { id: true, name: true, semester: true, year: true, isActive: true },
          orderBy: [{ year: "desc" }, { semester: "asc" }],
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(course);
  } catch (e) {
    console.error("Get course error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.code !== undefined) data.code = String(body.code).trim().toUpperCase();
    if (body.description !== undefined) data.description = body.description || null;
    if (body.creditHours !== undefined) {
      const ch = Number(body.creditHours);
      if (Number.isInteger(ch) && ch > 0) data.creditHours = ch;
    }
    if (body.departmentId !== undefined) {
      const did = Number(body.departmentId);
      if (!Number.isInteger(did)) {
        return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 });
      }
      data.departmentId = did;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const course = await prisma.course.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(course);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A course with this name or code already exists" },
        { status: 400 }
      );
    }
    console.error("Update course error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const count = await prisma.class.count({ where: { courseId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: "Cannot delete a course that has classes. Remove classes first." },
        { status: 400 }
      );
    }

    await prisma.course.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete course error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
