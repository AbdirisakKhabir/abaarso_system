import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { validateAttendanceTakerAssignment } from "@/lib/attendanceTaker";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await userHasPermission(auth.userId, "attendance.assign.edit");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const existing = await prisma.attendanceTaker.findUnique({
      where: { id },
      select: { id: true, classId: true, courseId: true, lecturerId: true, shift: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const body = await req.json();
    const classId =
      body.classId !== undefined ? Number(body.classId) : existing.classId;
    const courseId =
      body.courseId !== undefined ? Number(body.courseId) : existing.courseId;
    const lecturerId =
      body.lecturerId !== undefined ? Number(body.lecturerId) : existing.lecturerId;
    const shift =
      body.shift !== undefined ? String(body.shift).trim() : existing.shift;

    if (
      !Number.isInteger(classId) ||
      !Number.isInteger(courseId) ||
      !Number.isInteger(lecturerId) ||
      !shift
    ) {
      return NextResponse.json({ error: "Invalid assignment data" }, { status: 400 });
    }

    const validation = await validateAttendanceTakerAssignment({
      classId,
      courseId,
      lecturerId,
      shift,
      excludeId: id,
    });
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const data: {
      classId: number;
      courseId: number;
      lecturerId: number;
      shift: string;
      isActive?: boolean;
    } = { classId, courseId, lecturerId, shift };

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const row = await prisma.attendanceTaker.update({
      where: { id },
      data,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            semester: true,
            year: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        course: { select: { id: true, code: true, name: true } },
        lecturer: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(row);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "An attendance taker is already assigned for this class, course, and shift.",
        },
        { status: 400 }
      );
    }
    console.error("Update attendance taker error:", e);
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

    const allowed = await userHasPermission(auth.userId, "attendance.assign.delete");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await prisma.attendanceTaker.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete attendance taker error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
