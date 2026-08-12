import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const methodId = Number(id);
    if (!Number.isInteger(methodId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const data: {
      name?: string;
      description?: string | null;
      bankId?: number;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      data.name = trimmed;
    }
    if (body.description !== undefined) {
      data.description = body.description ? String(body.description).trim() : null;
    }
    if (body.bankId !== undefined) {
      const bid = Number(body.bankId);
      if (!Number.isInteger(bid)) {
        return NextResponse.json({ error: "Invalid bank" }, { status: 400 });
      }
      const bank = await prisma.bank.findUnique({ where: { id: bid } });
      if (!bank || !bank.isActive) {
        return NextResponse.json({ error: "Invalid or inactive bank" }, { status: 400 });
      }
      data.bankId = bid;
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const method = await prisma.paymentMethod.update({
      where: { id: methodId },
      data,
      include: { bank: { select: { id: true, name: true, code: true } } },
    });

    return NextResponse.json(method);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A payment method with this name already exists" },
        { status: 400 }
      );
    }
    console.error("Update payment method error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * DELETE /api/payment-methods/[id]
 * Only when unused by any payment; otherwise deactivate it instead.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const methodId = Number(id);
    if (!Number.isInteger(methodId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const method = await prisma.paymentMethod.findUnique({
      where: { id: methodId },
      select: { id: true },
    });
    if (!method) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    const usage = await prisma.tuitionPayment.count({
      where: { paymentMethodId: methodId },
    });
    if (usage > 0) {
      return NextResponse.json(
        {
          error:
            "This payment method is used by recorded payments and cannot be deleted. Deactivate it instead.",
        },
        { status: 400 }
      );
    }

    await prisma.paymentMethod.delete({ where: { id: methodId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete payment method error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
