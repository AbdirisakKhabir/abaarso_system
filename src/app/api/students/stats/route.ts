import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Grouped counts by status for dashboard-style stats (not paginated). */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await prisma.student.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const g of groups) {
      counts[g.status] = g._count._all;
    }

    return NextResponse.json(counts);
  } catch (e) {
    console.error("Student stats error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
