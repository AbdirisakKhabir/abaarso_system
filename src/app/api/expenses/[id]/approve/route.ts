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
    const canApprove = permissions.includes("expenses.approve") || user.role.name === "Admin";
    if (!canApprove) {
      return NextResponse.json(
        { error: "Only the President (or Admin) can approve expenses" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: parsedId },
      include: { bank: true },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expense.status !== "pending") {
      return NextResponse.json(
        { error: `Expense is already ${expense.status}` },
        { status: 400 }
      );
    }

    const updated = await prisma.expense.update({
      where: { id: parsedId },
      data: {
        status: "approved",
        approvedById: auth.userId,
        approvedAt: new Date(),
        rejectionReason: null,
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        bank: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Approve expense error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
