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

    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            course: { select: { id: true, name: true, code: true } },
          },
        },
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

    return NextResponse.json(session);
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
    const { note, records } = body;

    // Update session note
    if (note !== undefined) {
      await prisma.attendanceSession.update({
        where: { id },
        data: { note: note || null },
      });
    }

    // Update records if provided
    if (Array.isArray(records)) {
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
            course: { select: { id: true, name: true, code: true } },
          },
        },
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

    return NextResponse.json(session);
  } catch (e) {
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
