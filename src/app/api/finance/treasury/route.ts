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

    const banks = await prisma.bank.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });

    const totalBankBalance = banks.reduce((sum, b) => sum + (b.balance ?? 0), 0);

    const students = await prisma.student.findMany({
      where: { status: "Admitted" },
      select: { balance: true },
    });
    const totalReceivables = students.reduce((sum, s) => sum + (s.balance ?? 0), 0);

    const paymentsThisYear = await prisma.tuitionPayment.aggregate({
      where: { year: Number(year) },
      _sum: { amount: true },
      _count: true,
    });

    const withdrawalsThisYear = await prisma.bankWithdrawal.aggregate({
      where: {
        withdrawnAt: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lte: new Date(`${year}-12-31T23:59:59.999Z`),
        },
      },
      _sum: { amount: true },
      _count: true,
    });

    return NextResponse.json({
      banks,
      totalBankBalance,
      totalReceivables,
      year: Number(year),
      revenue: {
        totalPayments: paymentsThisYear._sum.amount ?? 0,
        paymentCount: paymentsThisYear._count,
      },
      withdrawals: {
        total: withdrawalsThisYear._sum.amount ?? 0,
        count: withdrawalsThisYear._count,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Treasury report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
