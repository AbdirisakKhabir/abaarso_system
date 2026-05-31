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

    const lecturer = await prisma.lecturer.findUnique({
      where: { id },
      include: {
        departments: { include: { department: { select: { id: true, name: true, code: true } } } },
        courses: { include: { course: { select: { id: true, name: true, code: true, department: { select: { id: true, name: true, code: true } } } } } },
      },
    });

    if (!lecturer) {
      return NextResponse.json(
        { error: "Lecturer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...lecturer,
      departments: lecturer.departments.map((d) => d.department),
      courses: lecturer.courses.map((c) => c.course),
    });
  } catch (e) {
    console.error("Get lecturer error:", e);
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
    if (body.email !== undefined)
      data.email = String(body.email).trim().toLowerCase();
    if (body.phone !== undefined)
      data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.degree !== undefined)
      data.degree = body.degree ? String(body.degree).trim() : null;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
    if (body.imagePublicId !== undefined) data.imagePublicId = body.imagePublicId ? String(body.imagePublicId).trim() : null;
    if (body.cvUrl !== undefined) data.cvUrl = body.cvUrl ? String(body.cvUrl).trim() : null;
    if (body.cvPublicId !== undefined) data.cvPublicId = body.cvPublicId ? String(body.cvPublicId).trim() : null;

    const deptIds = Array.isArray(body.departmentIds)
      ? body.departmentIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : undefined;
    const crsIds = Array.isArray(body.courseIds)
      ? body.courseIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : undefined;

    if (deptIds !== undefined) {
      await prisma.lecturerDepartment.deleteMany({ where: { lecturerId: id } });
      if (deptIds.length > 0) {
        await prisma.lecturerDepartment.createMany({
          data: deptIds.map((departmentId: number) => ({ lecturerId: id, departmentId })),
        });
      }
    }
    if (crsIds !== undefined) {
      await prisma.lecturerCourse.deleteMany({ where: { lecturerId: id } });
      if (crsIds.length > 0) {
        await prisma.lecturerCourse.createMany({
          data: crsIds.map((courseId: number) => ({ lecturerId: id, courseId })),
        });
      }
    }

    const lecturer = await prisma.lecturer.update({
      where: { id },
      data,
      include: {
        departments: { include: { department: { select: { id: true, name: true, code: true } } } },
        courses: { include: { course: { select: { id: true, name: true, code: true, department: { select: { id: true, name: true, code: true } } } } } },
      },
    });

    return NextResponse.json({
      ...lecturer,
      departments: lecturer.departments.map((d) => d.department),
      courses: lecturer.courses.map((c) => c.course),
    });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A lecturer with this email already exists" },
        { status: 400 }
      );
    }
    console.error("Update lecturer error:", e);
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

    await prisma.lecturer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete lecturer error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
