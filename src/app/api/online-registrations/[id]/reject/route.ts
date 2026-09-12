import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/online-registrations/:id/reject
 * Body: { reason? }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const check = await requirePermission(req, "admission.edit");
    if ("error" in check) return check.error;
    const { auth } = check;

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid registration ID" }, { status: 400 });
    }

    const registration = await prisma.onlineRegistration.findUnique({ where: { id } });
    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    if (registration.status !== "Pending") {
      return NextResponse.json(
        { error: `This application was already ${registration.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason ? String(body.reason).trim() : null;

    const updated = await prisma.onlineRegistration.update({
      where: { id },
      data: {
        status: "Rejected",
        rejectionReason: reason,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });

    await logActivity({
      userId: auth.userId,
      action: "online_registration.reject",
      module: "admission",
      summary: `Rejected online registration for ${registration.firstName} ${registration.lastName}`,
      metadata: { registrationId: registration.id, reason },
      req,
    });

    return NextResponse.json({ registration: updated });
  } catch (e) {
    console.error("online-registrations reject error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
