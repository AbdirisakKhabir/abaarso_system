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
    const y = Number(year) || new Date().getFullYear();

    const startOfYear = new Date(`${y}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${y}-12-31T23:59:59.999Z`);

    // Revenue: tuition payments
    const tuitionRevenue = await prisma.tuitionPayment.aggregate({
      where: { year: y },
      _sum: { amount: true },
      _count: true,
    });

    // Expenses: approved expenses
    const approvedExpenses = await prisma.expense.aggregate({
      where: {
        status: "approved",
        approvedAt: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Bank withdrawals (direct, not from expense workflow)
    const withdrawals = await prisma.bankWithdrawal.aggregate({
      where: {
        withdrawnAt: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { amount: true },
      _count: true,
    });

    const totalRevenue = tuitionRevenue._sum.amount ?? 0;
    const totalExpenses = (approvedExpenses._sum.amount ?? 0) + (withdrawals._sum.amount ?? 0);
    const netIncome = totalRevenue - totalExpenses;

    // Category breakdown for approved expenses
    const expensesByCategory = await prisma.expense.groupBy({
      by: ["category"],
      where: {
        status: "approved",
        approvedAt: { gte: startOfYear, lte: endOfYear },
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
      year: y,
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
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
