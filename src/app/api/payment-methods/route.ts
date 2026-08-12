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
    const includeInactive = searchParams.get("all") === "true";

    const methods = await prisma.paymentMethod.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        bank: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(methods);
  } catch (e) {
    console.error("Payment methods list error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, bankId, description } = body;

    const trimmedName = name ? String(name).trim() : "";
    const parsedBankId = bankId != null ? Number(bankId) : NaN;

    if (!trimmedName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!Number.isInteger(parsedBankId)) {
      return NextResponse.json({ error: "A linked bank is required" }, { status: 400 });
    }

    const bank = await prisma.bank.findUnique({ where: { id: parsedBankId } });
    if (!bank || !bank.isActive) {
      return NextResponse.json({ error: "Invalid or inactive bank" }, { status: 400 });
    }

    const method = await prisma.paymentMethod.create({
      data: {
        name: trimmedName,
        description: description ? String(description).trim() : null,
        bankId: parsedBankId,
      },
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
    console.error("Create payment method error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
