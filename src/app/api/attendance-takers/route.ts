import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { validateAttendanceTakerAssignment } from "@/lib/attendanceTaker";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await userHasPermission(auth.userId, "attendance.assign.view");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const courseId = searchParams.get("courseId");
    const departmentId = searchParams.get("departmentId");
    const activeOnly = searchParams.get("active") !== "false";

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;
    if (classId) where.classId = Number(classId);
    if (courseId) where.courseId = Number(courseId);
    if (departmentId) {
      where.class = { departmentId: Number(departmentId) };
    }

    const rows = await prisma.attendanceTaker.findMany({
      where,
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
      orderBy: [
        { class: { year: "desc" } },
        { class: { name: "asc" } },
        { course: { code: "asc" } },
        { shift: "asc" },
      ],
    });

    return NextResponse.json(rows);
  } catch (e) {
    console.error("List attendance takers error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await userHasPermission(auth.userId, "attendance.assign.create");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const classId = Number(body.classId);
    const courseId = Number(body.courseId);
    const lecturerId = Number(body.lecturerId);
    const shift = String(body.shift ?? "").trim();

    if (
      !Number.isInteger(classId) ||
      !Number.isInteger(courseId) ||
      !Number.isInteger(lecturerId) ||
      !shift
    ) {
      return NextResponse.json(
        { error: "classId, courseId, lecturerId, and shift are required" },
        { status: 400 }
      );
    }

    const validation = await validateAttendanceTakerAssignment({
      classId,
      courseId,
      lecturerId,
      shift,
    });
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const row = await prisma.attendanceTaker.create({
      data: {
        classId,
        courseId,
        lecturerId,
        shift,
        assignedById: auth.userId,
      },
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
    console.error("Create attendance taker error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
