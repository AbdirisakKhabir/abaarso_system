import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncMissingAttendanceMarks } from "@/lib/attendance-marks-sync";
import { logActivity } from "@/lib/activity-log";

/**
 * Fill exam results saved with a 0/empty attendance mark (idempotent). Admin-only.
 * Body: { apply?: boolean (default false = preview), classId?, courseId? }
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

    const body = await req.json().catch(() => ({}));
    const apply = body.apply === true;
    const classId = Number(body.classId);
    const courseId = Number(body.courseId);

    const result = await syncMissingAttendanceMarks({
      dryRun: !apply,
      ...(Number.isInteger(classId) && classId > 0 ? { classId } : {}),
      ...(Number.isInteger(courseId) && courseId > 0 ? { courseId } : {}),
    });

    if (apply && result.changes.length > 0) {
      await logActivity({
        userId: auth.userId,
        action: "examinations.attendance_marks.sync",
        module: "examinations",
        summary: `Filled missing attendance marks on ${result.changes.length} exam result(s)`,
        metadata: { examRecordIds: result.changes.map((c) => c.examRecordId) },
        req,
      });
    }

    return NextResponse.json({ ok: true, applied: apply, ...result });
  } catch (e) {
    console.error("Sync attendance marks error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
