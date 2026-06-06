import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { validateAttendanceTakerAssignment } from "@/lib/attendanceTaker";

const includeAssignment = {
  class: {
    select: {
      id: true,
      name: true,
      semester: true,
      year: true,
      department: { select: { id: true, name: true, code: true } },
    },
  },
  lecturer: { select: { id: true, name: true, email: true } },
  assignedBy: { select: { id: true, name: true, email: true } },
} as const;

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
    const lecturerId = searchParams.get("lecturerId");
    const departmentId = searchParams.get("departmentId");
    const activeOnly = searchParams.get("active") !== "false";

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;
    if (classId) where.classId = Number(classId);
    if (lecturerId) where.lecturerId = Number(lecturerId);
    if (departmentId) {
      where.class = { departmentId: Number(departmentId) };
    }

    const rows = await prisma.attendanceTaker.findMany({
      where,
      include: includeAssignment,
      orderBy: [
        { lecturer: { name: "asc" } },
        { class: { year: "desc" } },
        { class: { name: "asc" } },
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
    const lecturerId = Number(body.lecturerId);
    const classIds = Array.isArray(body.classIds)
      ? body.classIds
          .map((id: unknown) => Number(id))
          .filter((id: number) => Number.isInteger(id) && id > 0)
      : body.classId !== undefined
        ? [Number(body.classId)].filter((id) => Number.isInteger(id) && id > 0)
        : [];

    if (!Number.isInteger(lecturerId) || lecturerId <= 0) {
      return NextResponse.json({ error: "lecturerId is required" }, { status: 400 });
    }
    if (classIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one class" },
        { status: 400 }
      );
    }

    const created = [];
    const skipped: { classId: number; error: string }[] = [];

    for (const classId of classIds) {
      const validation = await validateAttendanceTakerAssignment({
        classId,
        lecturerId,
      });
      if (!validation.ok) {
        skipped.push({ classId, error: validation.error });
        continue;
      }

      try {
        const row = await prisma.attendanceTaker.create({
          data: {
            classId,
            lecturerId,
            assignedById: auth.userId,
          },
          include: includeAssignment,
        });
        created.push(row);
      } catch (e: unknown) {
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code: string }).code === "P2002"
        ) {
          skipped.push({
            classId,
            error: "This lecturer is already assigned to this class.",
          });
        } else {
          throw e;
        }
      }
    }

    if (created.length === 0) {
      return NextResponse.json(
        {
          error:
            skipped[0]?.error ||
            "No assignments were created. The lecturer may already be assigned to the selected classes.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      created,
      skipped,
      message:
        skipped.length > 0
          ? `Assigned ${created.length} class(es). ${skipped.length} skipped.`
          : `Assigned ${created.length} class(es).`,
    });
  } catch (e) {
    console.error("Create attendance taker error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
