import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { bankId, amount, reason } = body;

    if (!bankId || amount == null || amount <= 0) {
      return NextResponse.json(
        { error: "Bank ID and positive amount are required" },
        { status: 400 }
      );
    }

    const amt = Number(amount);

    const result = await prisma.$transaction(async (tx) => {
      const bank = await tx.bank.findUnique({
        where: { id: Number(bankId) },
      });

      if (!bank) {
        throw new Error("Bank not found");
      }

      if (bank.balance < amt) {
        throw new Error("Insufficient bank balance");
      }

      const withdrawal = await tx.bankWithdrawal.create({
        data: {
          bankId: bank.id,
          amount: amt,
          reason: reason ? String(reason).trim() : null,
          createdById: auth.userId,
        },
      });

      await tx.bank.update({
        where: { id: bank.id },
        data: { balance: { decrement: amt } },
      });

      await tx.transactionHistory.create({
        data: {
          type: "withdrawal",
          amount: amt,
          bankId: bank.id,
          description: reason ? `Withdrawal: ${reason}` : "Bank withdrawal",
          bankWithdrawalId: withdrawal.id,
          createdById: auth.userId,
        },
      });

      return withdrawal;
    });

    const withdrawal = await prisma.bankWithdrawal.findUnique({
      where: { id: result.id },
      include: {
        bank: { select: { id: true, name: true, code: true, balance: true } },
      },
    });

    return NextResponse.json(withdrawal);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Something went wrong";
    if (msg === "Bank not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "Insufficient bank balance") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("Bank withdraw error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
