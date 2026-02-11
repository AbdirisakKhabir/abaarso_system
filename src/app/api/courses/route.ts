import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courses = await prisma.course.findMany({
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        _count: { select: { classes: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      courses.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        description: c.description,
        creditHours: c.creditHours,
        departmentId: c.departmentId,
        department: c.department,
        isActive: c.isActive,
        classCount: c._count.classes,
        createdAt: c.createdAt,
      }))
    );
  } catch (e) {
    console.error("Courses list error:", e);
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
    const { name, code, description, creditHours, departmentId } = body;
    const parsedDeptId = Number(departmentId);
    const parsedCredits = Number(creditHours);

    if (!name || !code || !Number.isInteger(parsedDeptId)) {
      return NextResponse.json(
        { error: "Name, code, and departmentId are required" },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        description: description || null,
        creditHours: Number.isInteger(parsedCredits) && parsedCredits > 0 ? parsedCredits : 3,
        departmentId: parsedDeptId,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(course);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A course with this name or code already exists" },
        { status: 400 }
      );
    }
    console.error("Create course error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
