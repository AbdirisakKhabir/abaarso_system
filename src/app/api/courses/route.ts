import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { paginate, page, pageSize, skip } = parsePaginationParams(searchParams);
    const q = searchParams.get("q")?.trim();
    const departmentId = searchParams.get("departmentId");
    const where: Prisma.CourseWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { description: { contains: q } },
      ];
    }
    if (departmentId && departmentId !== "all") {
      const id = Number(departmentId);
      if (Number.isInteger(id) && id > 0) where.departmentId = id;
    }

    const include = {
      department: {
        select: { id: true, name: true, code: true },
      },
      _count: { select: { classSchedules: true } },
    } as const;

    const mapCourse = (c: {
      id: number;
      name: string;
      code: string;
      description: string | null;
      creditHours: number;
      departmentId: number;
      department: { id: number; name: string; code: string };
      isActive: boolean;
      createdAt: Date;
      _count: { classSchedules: number };
    }) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      description: c.description,
      creditHours: c.creditHours,
      departmentId: c.departmentId,
      department: c.department,
      isActive: c.isActive,
      createdAt: c.createdAt,
      classCount: c._count?.classSchedules ?? 0,
    });

    if (paginate) {
      const [rows, total] = await Promise.all([
        prisma.course.findMany({
          where,
          skip,
          take: pageSize,
          include,
          orderBy: { name: "asc" },
        }),
        prisma.course.count({ where }),
      ]);
      return NextResponse.json({
        items: rows.map(mapCourse),
        total,
        page,
        pageSize,
      });
    }

    const courses = await prisma.course.findMany({
      where,
      include,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(courses.map(mapCourse));
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
        { error: "A course with this name or code already exists in this department" },
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
