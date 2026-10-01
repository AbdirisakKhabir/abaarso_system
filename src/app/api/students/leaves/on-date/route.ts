import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findStudentsOnLeave, parseLeaveDate } from "@/lib/student-leave";

/**
 * GET /api/students/leaves/on-date?date=YYYY-MM-DD&studentIds=1,2,3
 * Students (from the list) with an ongoing approved leave on that date —
 * their attendance is locked to Present.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = parseLeaveDate(searchParams.get("date"));
    if (!date) return NextResponse.json({ error: "A valid date is required" }, { status: 400 });

    const studentIds = (searchParams.get("studentIds") ?? "")
      .split(",")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 1000);

    const map = await findStudentsOnLeave(prisma, studentIds, date);
    return NextResponse.json({ leaves: [...map.values()] });
  } catch (e) {
    console.error("students on leave GET error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
