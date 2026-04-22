import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");

    let rangeStart: Date;
    let rangeEnd: Date;
    let dateFrom: string;
    let dateTo: string;
    /** Calendar year label (start of range) for titles */
    let year: number;

    if (
      dateFromParam &&
      dateToParam &&
      ISO_DATE.test(dateFromParam) &&
      ISO_DATE.test(dateToParam)
    ) {
      rangeStart = new Date(`${dateFromParam}T00:00:00.000Z`);
      rangeEnd = new Date(`${dateToParam}T23:59:59.999Z`);
      if (rangeStart > rangeEnd) {
        return NextResponse.json(
          { error: "dateFrom must be on or before dateTo" },
          { status: 400 }
        );
      }
      dateFrom = dateFromParam;
      dateTo = dateToParam;
      year = rangeStart.getUTCFullYear();
    } else {
      const y =
        Number(searchParams.get("year")) || new Date().getUTCFullYear();
      year = y;
      dateFrom = `${y}-01-01`;
      dateTo = `${y}-12-31`;
      rangeStart = new Date(`${y}-01-01T00:00:00.000Z`);
      rangeEnd = new Date(`${y}-12-31T23:59:59.999Z`);
    }

    const usePaidAtForTuition =
      Boolean(dateFromParam && dateToParam &&
        ISO_DATE.test(dateFromParam) &&
        ISO_DATE.test(dateToParam));

    // Revenue: tuition — by payment record date in range, or legacy calendar year on tuition.year
    const tuitionRevenue = usePaidAtForTuition
      ? await prisma.tuitionPayment.aggregate({
          where: {
            paidAt: { gte: rangeStart, lte: rangeEnd },
          },
          _sum: { amount: true },
          _count: true,
        })
      : await prisma.tuitionPayment.aggregate({
          where: { year },
          _sum: { amount: true },
          _count: true,
        });

    const approvedExpenses = await prisma.expense.aggregate({
      where: {
        status: "approved",
        approvedAt: { gte: rangeStart, lte: rangeEnd },
      },
      _sum: { amount: true },
      _count: true,
    });

    const withdrawals = await prisma.bankWithdrawal.aggregate({
      where: {
        withdrawnAt: { gte: rangeStart, lte: rangeEnd },
      },
      _sum: { amount: true },
      _count: true,
    });

    const totalRevenue = tuitionRevenue._sum.amount ?? 0;
    const totalExpenses =
      (approvedExpenses._sum.amount ?? 0) + (withdrawals._sum.amount ?? 0);
    const netIncome = totalRevenue - totalExpenses;

    const expensesByCategory = await prisma.expense.groupBy({
      by: ["category"],
      where: {
        status: "approved",
        approvedAt: { gte: rangeStart, lte: rangeEnd },
      },
      _sum: { amount: true },
      _count: true,
    });

    const expenseCategories = expensesByCategory.map((e) => ({
      category: e.category || "Uncategorized",
      amount: e._sum.amount ?? 0,
      count: e._count,
    }));

    return NextResponse.json({
      year,
      dateFrom,
      dateTo,
      revenue: {
        tuition: totalRevenue,
        paymentCount: tuitionRevenue._count,
      },
      expenses: {
        approvedExpenses: approvedExpenses._sum.amount ?? 0,
        approvedCount: approvedExpenses._count,
        withdrawals: withdrawals._sum.amount ?? 0,
        withdrawalCount: withdrawals._count,
        total: totalExpenses,
      },
      expenseCategories,
      netIncome,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Income statement error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
