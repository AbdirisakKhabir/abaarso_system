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

    const semester = await prisma.semester.findUnique({ where: { id } });
    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    return NextResponse.json(semester);
  } catch (e) {
    console.error("Get semester error:", e);
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
    if (body.sortOrder !== undefined)
      data.sortOrder = Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const semester = await prisma.semester.update({
      where: { id },
      data,
    });

    return NextResponse.json(semester);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A semester with this name already exists" },
        { status: 400 }
      );
    }
    console.error("Update semester error:", e);
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

    const semester = await prisma.semester.findUnique({ where: { id } });
    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    // Check if semester is in use (classes, tuition payments, exam records)
    const [classCount, paymentCount, examCount] = await Promise.all([
      prisma.class.count({ where: { semester: semester.name } }),
      prisma.tuitionPayment.count({ where: { semester: semester.name } }),
      prisma.examRecord.count({ where: { semester: semester.name } }),
    ]);

    if (classCount > 0 || paymentCount > 0 || examCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete. This semester is used by ${classCount} class(es), ${paymentCount} payment(s), and ${examCount} exam record(s). Deactivate it instead.`,
        },
        { status: 400 }
      );
    }

    await prisma.semester.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete semester error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
