import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseProgram } from "@/lib/program";

const registrationInclude = {
  department: { select: { id: true, name: true, code: true, tuitionFee: true } },
  class: { select: { id: true, name: true, semester: true, year: true } },
  student: { select: { id: true, studentId: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
} as const;

/**
 * GET /api/online-registrations
 * status=Pending (default) | Approved | Rejected | all
 */
export async function GET(req: NextRequest) {
  try {
    const check = await requirePermission(req, "admission.view");
    if ("error" in check) return check.error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "Pending";
    const program = parseProgram(searchParams.get("program"), { allowAll: true });
    const departmentId = Number(searchParams.get("departmentId"));
    const q = searchParams.get("q")?.trim() || "";

    const where: Prisma.OnlineRegistrationWhereInput = {};
    if (status !== "all") where.status = status;
    if (program && program !== "all") where.program = program;
    if (Number.isInteger(departmentId) && departmentId > 0) where.departmentId = departmentId;
    if (q) {
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const [items, pendingCount] = await Promise.all([
      prisma.onlineRegistration.findMany({
        where,
        include: registrationInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.onlineRegistration.count({ where: { status: "Pending" } }),
    ]);

    return NextResponse.json({ items, pendingCount });
  } catch (e) {
    console.error("online-registrations GET error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
