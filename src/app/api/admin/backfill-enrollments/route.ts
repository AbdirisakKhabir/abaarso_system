import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backfillEnrollments } from "@/lib/enrollment-backfill";

/**
 * One-time (idempotent) reconstruction of student enrollment history so per-term
 * reports stay correct after students are upgraded to a new semester.
 * Admin-only.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { isActive: true, role: { select: { name: true } } },
    });
    const roleName = user?.role?.name?.toLowerCase() ?? "";
    const isAdmin = roleName.includes("admin") || roleName.includes("super");
    if (!user?.isActive || !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await backfillEnrollments();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("Backfill enrollments error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
