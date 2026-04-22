import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const bankId = Number(id);
    if (!Number.isInteger(bankId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
      include: {
        tuitionPayments: {
          orderBy: { paidAt: "desc" },
          take: 20,
          include: {
            student: { select: { studentId: true, firstName: true, lastName: true } },
          },
        },
        withdrawals: { orderBy: { withdrawnAt: "desc" }, take: 10 },
        transfersOut: { orderBy: { transferredAt: "desc" }, take: 10, include: { toBank: { select: { name: true, code: true } } } },
        transfersIn: { orderBy: { transferredAt: "desc" }, take: 10, include: { fromBank: { select: { name: true, code: true } } } },
      },
    });

    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    return NextResponse.json(bank);
  } catch (e) {
    console.error("Get bank error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const bankId = Number(id);
    if (!Number.isInteger(bankId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const data: { name?: string; code?: string; accountNumber?: string | null; isActive?: boolean } = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.code !== undefined) data.code = String(body.code).trim().toUpperCase();
    if (body.accountNumber !== undefined) data.accountNumber = body.accountNumber ? String(body.accountNumber).trim() : null;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const bank = await prisma.bank.update({
      where: { id: bankId },
      data,
    });

    return NextResponse.json(bank);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A bank with this code already exists" },
        { status: 400 }
      );
    }
    console.error("Update bank error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * DELETE /api/banks/[id]
 * Only allowed when balance is zero and there is no activity that blocks FK (withdrawals, transfers, ledger rows).
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const bankId = Number(id);
    if (!Number.isInteger(bankId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true, name: true, code: true, balance: true },
    });
    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    if (Math.abs(bank.balance ?? 0) > 0.009) {
      return NextResponse.json(
        { error: "Bank balance must be zero before deletion. Withdraw or transfer funds first." },
        { status: 400 }
      );
    }

    const [withdrawals, transfersFrom, transfersTo, ledgerRows] = await Promise.all([
      prisma.bankWithdrawal.count({ where: { bankId } }),
      prisma.bankTransfer.count({ where: { fromBankId: bankId } }),
      prisma.bankTransfer.count({ where: { toBankId: bankId } }),
      prisma.transactionHistory.count({ where: { bankId } }),
    ]);

    if (withdrawals > 0 || transfersFrom > 0 || transfersTo > 0 || ledgerRows > 0) {
      return NextResponse.json(
        {
          error:
            "This bank has withdrawals, transfers, or ledger history and cannot be deleted. Deactivate it instead (edit bank).",
        },
        { status: 400 }
      );
    }

    await prisma.bank.delete({ where: { id: bankId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete bank error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
