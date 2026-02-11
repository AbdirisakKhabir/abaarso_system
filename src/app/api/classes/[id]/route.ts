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

    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    return NextResponse.json(cls);
  } catch (e) {
    console.error("Get class error:", e);
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
    if (body.courseId !== undefined) {
      const cid = Number(body.courseId);
      if (!Number.isInteger(cid)) {
        return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
      }
      data.courseId = cid;
    }
    if (body.semester !== undefined) data.semester = String(body.semester).trim();
    if (body.year !== undefined) {
      const y = Number(body.year);
      if (!Number.isInteger(y)) {
        return NextResponse.json({ error: "Invalid year" }, { status: 400 });
      }
      data.year = y;
    }
    if (body.room !== undefined) data.room = body.room || null;
    if (body.schedule !== undefined) data.schedule = body.schedule || null;
    if (body.capacity !== undefined) {
      const cap = Number(body.capacity);
      if (cap > 0) data.capacity = cap;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const cls = await prisma.class.update({
      where: { id },
      data,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return NextResponse.json(cls);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A class with this name in the same semester/year already exists" },
        { status: 400 }
      );
    }
    console.error("Update class error:", e);
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

    await prisma.class.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete class error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
