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
    const type = searchParams.get("type"); // "deposits" | "withdrawals" | "transfers" | "all"
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const bankFilter = bankId ? Number(bankId) : undefined;

    const deposits = await prisma.tuitionPayment.findMany({
      where: {
        ...(bankFilter ? { bankId: bankFilter } : {}),
        ...(dateFrom || dateTo
          ? {
              paidAt: {
                ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00.000Z") } : {}),
                ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
              },
            }
          : {}),
      },
      include: {
        student: { select: { studentId: true, firstName: true, lastName: true } },
        bank: { select: { name: true, code: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 500,
    });

    const withdrawals = await prisma.bankWithdrawal.findMany({
      where: {
        ...(bankFilter ? { bankId: bankFilter } : {}),
        ...(dateFrom || dateTo
          ? {
              withdrawnAt: {
                ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00.000Z") } : {}),
                ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
              },
            }
          : {}),
      },
      include: { bank: { select: { name: true, code: true } } },
      orderBy: { withdrawnAt: "desc" },
      take: 500,
    });

    const transfersOut = await prisma.bankTransfer.findMany({
      where: {
        ...(bankFilter ? { fromBankId: bankFilter } : {}),
        ...(dateFrom || dateTo
          ? {
              transferredAt: {
                ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00.000Z") } : {}),
                ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
              },
            }
          : {}),
      },
      include: {
        fromBank: { select: { name: true, code: true } },
        toBank: { select: { name: true, code: true } },
      },
      orderBy: { transferredAt: "desc" },
      take: 500,
    });

    const transfersIn = await prisma.bankTransfer.findMany({
      where: {
        ...(bankFilter ? { toBankId: bankFilter } : {}),
        ...(dateFrom || dateTo
          ? {
              transferredAt: {
                ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00.000Z") } : {}),
                ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
              },
            }
          : {}),
      },
      include: {
        fromBank: { select: { name: true, code: true } },
        toBank: { select: { name: true, code: true } },
      },
      orderBy: { transferredAt: "desc" },
      take: 500,
    });

    return NextResponse.json({
      deposits,
      withdrawals,
      transfersOut,
      transfersIn,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Bank transactions report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
