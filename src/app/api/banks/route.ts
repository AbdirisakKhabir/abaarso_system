import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const banks = await prisma.bank.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });

    return NextResponse.json(banks);
  } catch (e) {
    console.error("Banks list error:", e);
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
    const { name, code, accountNumber } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    const bank = await prisma.bank.create({
      data: {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        accountNumber: accountNumber ? String(accountNumber).trim() : null,
        balance: 0,
      },
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
    console.error("Create bank error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
