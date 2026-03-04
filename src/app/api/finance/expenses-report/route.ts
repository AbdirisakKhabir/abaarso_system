import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const status = searchParams.get("status");

    const where: { status?: string } = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      where.status = status;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        bank: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const y = Number(year);
    const filtered = Number.isNaN(y)
      ? expenses
      : expenses.filter((e) => new Date(e.createdAt).getFullYear() === y);

    const totals = {
      pending: filtered.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0),
      approved: filtered.filter((e) => e.status === "approved").reduce((s, e) => s + e.amount, 0),
      rejected: filtered.filter((e) => e.status === "rejected").reduce((s, e) => s + e.amount, 0),
      total: filtered.reduce((s, e) => s + e.amount, 0),
    };

    return NextResponse.json({
      expenses: filtered,
      totals,
      year: Number.isNaN(y) ? new Date().getFullYear() : y,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Expenses report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
