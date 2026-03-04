import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { position: { select: { id: true, name: true } } },
    });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    return NextResponse.json(employee);
  } catch (e) {
    console.error("Get employee error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.positionId !== undefined) data.positionId = Number(body.positionId);
    if (body.department !== undefined) data.department = body.department ? String(body.department).trim() : null;
    if (body.hireDate !== undefined) data.hireDate = new Date(body.hireDate);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const employee = await prisma.employee.update({
      where: { id },
      data,
      include: { position: { select: { id: true, name: true } } },
    });
    return NextResponse.json(employee);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "An employee with this email already exists" }, { status: 400 });
    }
    console.error("Update employee error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete employee error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
