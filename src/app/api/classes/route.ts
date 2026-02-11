import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const classes = await prisma.class.findMany({
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ year: "desc" }, { semester: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(classes);
  } catch (e) {
    console.error("Classes list error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, courseId, semester, year, room, schedule, capacity } = body;
    const parsedCourseId = Number(courseId);
    const parsedYear = Number(year);

    if (!name || !Number.isInteger(parsedCourseId) || !semester || !Number.isInteger(parsedYear)) {
      return NextResponse.json(
        { error: "Name, courseId, semester, and year are required" },
        { status: 400 }
      );
    }

    const cls = await prisma.class.create({
      data: {
        name: String(name).trim(),
        courseId: parsedCourseId,
        semester: String(semester).trim(),
        year: parsedYear,
        room: room || null,
        schedule: schedule || null,
        capacity: Number(capacity) > 0 ? Number(capacity) : 40,
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return NextResponse.json(cls);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A class with this name in the same semester/year already exists" },
        { status: 400 }
      );
    }
    console.error("Create class error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
