import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedAttendanceStatus } from "@/lib/attendanceConstants";
import {
  assertUserCanManageAttendanceSession,
  userCanManageAttendanceSession,
} from "@/lib/attendanceTaker";

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

    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        course: { select: { id: true, code: true, name: true } },
        takenBy: { select: { id: true, name: true, email: true } },
        records: {
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { student: { firstName: "asc" } },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const canManage = await userCanManageAttendanceSession(
      auth.userId,
      session.classId
    );

    return NextResponse.json({ ...session, canManage });
  } catch (e) {
    console.error("Get attendance error:", e);
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
    const { note, records, date } = body;

    const existing = await prisma.attendanceSession.findUnique({
      where: { id },
      select: { id: true, classId: true, courseId: true, shift: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const access = await assertUserCanManageAttendanceSession(
      auth.userId,
      existing.classId
    );
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const sessionUpdates: { note?: string | null; date?: Date } = {};

    if (note !== undefined) {
      sessionUpdates.note = note || null;
    }

    if (date !== undefined) {
      if (!date) {
        return NextResponse.json({ error: "Date is required" }, { status: 400 });
      }
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }

      const conflict = await prisma.attendanceSession.findFirst({
        where: {
          classId: existing.classId,
          courseId: existing.courseId,
          shift: existing.shift,
          date: parsedDate,
          NOT: { id },
        },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json(
          {
            error:
              "Attendance for this class, course, date, and shift already exists",
          },
          { status: 400 }
        );
      }

      sessionUpdates.date = parsedDate;
    }

    if (Object.keys(sessionUpdates).length > 0) {
      await prisma.attendanceSession.update({
        where: { id },
        data: sessionUpdates,
      });
    }

    // Update records if provided
    if (Array.isArray(records)) {
      for (const r of records) {
        if (!r.status || !isAllowedAttendanceStatus(String(r.status))) {
          return NextResponse.json(
            {
              error:
                "Each record status must be one of: Present, Absent, Excused",
            },
            { status: 400 }
          );
        }
      }
      for (const r of records) {
        await prisma.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: id,
              studentId: Number(r.studentId),
            },
          },
          create: {
            sessionId: id,
            studentId: Number(r.studentId),
            status: r.status,
            note: r.note || null,
          },
          update: {
            status: r.status,
            note: r.note || null,
          },
        });
      }
    }

    // Return updated session
    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        course: { select: { id: true, code: true, name: true } },
        takenBy: { select: { id: true, name: true, email: true } },
        records: {
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { student: { firstName: "asc" } },
        },
      },
    });

    return NextResponse.json({ ...session, canManage: true });
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
            "Attendance for this class, course, date, and shift already exists",
        },
        { status: 400 }
      );
    }
    console.error("Update attendance error:", e);
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

    await prisma.attendanceSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete attendance error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
