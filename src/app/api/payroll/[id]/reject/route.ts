import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.name);
    const canApprove = permissions.includes("payroll.approve") || user.role.name === "Admin";
    if (!canApprove) {
      return NextResponse.json(
        { error: "Only the President (or Admin) can reject payroll" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      return NextResponse.json({ error: "Invalid payroll ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const rejectionReason = body.rejectionReason ? String(body.rejectionReason).trim() : null;

    const payroll = await prisma.payroll.findUnique({
      where: { id: parsedId },
    });

    if (!payroll) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
    }

    if (payroll.status !== "pending") {
      return NextResponse.json(
        { error: `Payroll is already ${payroll.status}` },
        { status: 400 }
      );
    }

    const updated = await prisma.payroll.update({
      where: { id: parsedId },
      data: {
        status: "rejected",
        approvedById: auth.userId,
        approvedAt: new Date(),
        rejectionReason,
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        bank: { select: { id: true, name: true, code: true } },
        employee: { select: { id: true, name: true, email: true, position: { select: { name: true } } } },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Reject payroll error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
