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

    const totalBalance = banks.reduce((sum, b) => sum + (b.balance ?? 0), 0);

    return NextResponse.json({
      banks,
      totalBalance,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Bank balances report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
