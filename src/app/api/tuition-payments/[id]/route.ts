import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/tuition-payments/[id]
 * Reverses a recorded tuition deposit: restores student balance, reduces bank balance, removes history row.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
    }

    const payment = await prisma.tuitionPayment.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        bankId: true,
        amount: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const amt = payment.amount ?? 0;
    if (amt <= 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transactionHistory.deleteMany({
        where: { tuitionPaymentId: id },
      });

      await tx.student.update({
        where: { id: payment.studentId },
        data: { balance: { increment: amt } },
      });

      if (payment.bankId != null) {
        const bank = await tx.bank.findUnique({
          where: { id: payment.bankId },
          select: { balance: true },
        });
        const bal = bank?.balance ?? 0;
        if (bal + 1e-9 < amt) {
          throw new Error("BANK_BALANCE_UNDERFLOW");
        }
        await tx.bank.update({
          where: { id: payment.bankId },
          data: { balance: { decrement: amt } },
        });
      }

      await tx.tuitionPayment.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "message" in e && (e as Error).message === "BANK_BALANCE_UNDERFLOW") {
      return NextResponse.json(
        {
          error:
            "Cannot delete this payment: bank balance is lower than the payment amount. Fix bank records first.",
        },
        { status: 409 }
      );
    }
    console.error("Delete tuition payment error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
