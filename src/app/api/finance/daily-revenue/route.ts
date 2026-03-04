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
    const dateFrom = searchParams.get("dateFrom") || new Date().toISOString().slice(0, 10);
    const dateTo = searchParams.get("dateTo") || new Date().toISOString().slice(0, 10);
    const bankId = searchParams.get("bankId");

    const payments = await prisma.tuitionPayment.findMany({
      where: {
        paidAt: {
          gte: new Date(dateFrom + "T00:00:00.000Z"),
          lte: new Date(dateTo + "T23:59:59.999Z"),
        },
        ...(bankId ? { bankId: Number(bankId) } : {}),
      },
      include: {
        student: { select: { studentId: true, firstName: true, lastName: true } },
        bank: { select: { name: true, code: true } },
      },
      orderBy: { paidAt: "desc" },
    });

    const byDate: Record<string, { total: number; count: number; payments: typeof payments }> = {};
    for (const p of payments) {
      const d = p.paidAt.toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = { total: 0, count: 0, payments: [] };
      byDate[d].total += p.amount;
      byDate[d].count += 1;
      byDate[d].payments.push(p);
    }

    const dailySummary = Object.entries(byDate)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      dateFrom,
      dateTo,
      totalRevenue,
      totalCount: payments.length,
      dailySummary,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Daily revenue report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
