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
    const { fromBankId, toBankId, amount, reason } = body;

    if (!fromBankId || !toBankId || amount == null || amount <= 0) {
      return NextResponse.json(
        { error: "From bank, to bank, and positive amount are required" },
        { status: 400 }
      );
    }

    const fromId = Number(fromBankId);
    const toId = Number(toBankId);
    const amt = Number(amount);

    if (fromId === toId) {
      return NextResponse.json(
        { error: "Source and destination banks must be different" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const fromBank = await tx.bank.findUnique({ where: { id: fromId } });
      const toBank = await tx.bank.findUnique({ where: { id: toId } });

      if (!fromBank || !toBank) {
        throw new Error("Bank not found");
      }

      if (fromBank.balance < amt) {
        throw new Error("Insufficient balance in source bank");
      }

      const transfer = await tx.bankTransfer.create({
        data: {
          fromBankId: fromId,
          toBankId: toId,
          amount: amt,
          reason: reason ? String(reason).trim() : null,
          createdById: auth.userId,
        },
      });

      await tx.bank.update({
        where: { id: fromId },
        data: { balance: { decrement: amt } },
      });

      await tx.bank.update({
        where: { id: toId },
        data: { balance: { increment: amt } },
      });

      await tx.transactionHistory.createMany({
        data: [
          {
            type: "transfer_out",
            amount: amt,
            bankId: fromId,
            relatedBankId: toId,
            description: reason ? `Transfer to ${toBank.code}: ${reason}` : `Transfer to ${toBank.code}`,
            bankTransferId: transfer.id,
            createdById: auth.userId,
          },
          {
            type: "transfer_in",
            amount: amt,
            bankId: toId,
            relatedBankId: fromId,
            description: reason ? `Transfer from ${fromBank.code}: ${reason}` : `Transfer from ${fromBank.code}`,
            bankTransferId: transfer.id,
            createdById: auth.userId,
          },
        ],
      });

      return transfer;
    });

    const transfer = await prisma.bankTransfer.findUnique({
      where: { id: result.id },
      include: {
        fromBank: { select: { id: true, name: true, code: true, balance: true } },
        toBank: { select: { id: true, name: true, code: true, balance: true } },
      },
    });

    return NextResponse.json(transfer);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Something went wrong";
    if (msg === "Bank not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "Insufficient balance in source bank") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("Bank transfer error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
