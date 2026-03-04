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
    const bankId = searchParams.get("bankId");
    const type = searchParams.get("type"); // deposit | withdrawal | transfer_out | transfer_in
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

    const where: { bankId?: number; type?: string; createdAt?: { gte?: Date; lte?: Date } } = {};
    if (bankId) where.bankId = Number(bankId);
    if (type) where.type = type;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom + "T00:00:00.000Z");
      if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
    }

    const transactions = await prisma.transactionHistory.findMany({
      where,
      include: {
        bank: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(transactions);
  } catch (e) {
    console.error("Transaction history error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
