import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLecturerIdForUser, userIsAdmin } from "@/lib/attendanceTaker";

/** Active attendance taker assignments for the current user (or all for admin). */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await userIsAdmin(auth.userId);
    if (isAdmin) {
      return NextResponse.json({ isAdmin: true, assignments: [] });
    }

    const lecturerId = await getLecturerIdForUser(auth.userId);
    if (!lecturerId) {
      return NextResponse.json({
        isAdmin: false,
        lecturerId: null,
        assignments: [],
      });
    }

    const assignments = await prisma.attendanceTaker.findMany({
      where: { lecturerId, isActive: true },
      select: {
        id: true,
        classId: true,
        courseId: true,
        shift: true,
        class: {
          select: {
            id: true,
            name: true,
            semester: true,
            year: true,
            departmentId: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        course: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ class: { name: "asc" } }, { course: { code: "asc" } }],
    });

    return NextResponse.json({
      isAdmin: false,
      lecturerId,
      assignments,
    });
  } catch (e) {
    console.error("My attendance takers error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
