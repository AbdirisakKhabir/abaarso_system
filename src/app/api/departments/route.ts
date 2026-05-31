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
    const facultyId = searchParams.get("facultyId");
    const activeOnly = searchParams.get("active") === "true";
    const where: Prisma.DepartmentWhereInput = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { description: { contains: q } },
        { faculty: { name: { contains: q } } },
      ];
    }
    if (facultyId && facultyId !== "all") {
      const id = Number(facultyId);
      if (Number.isInteger(id) && id > 0) where.facultyId = id;
    }

    const include = {
      faculty: { select: { id: true, name: true, code: true } },
    } as const;

    if (paginate) {
      const [items, total] = await Promise.all([
        prisma.department.findMany({
          where,
          skip,
          take: pageSize,
          include,
          orderBy: { name: "asc" },
        }),
        prisma.department.count({ where }),
      ]);
      return NextResponse.json({ items, total, page, pageSize });
    }

    const departments = await prisma.department.findMany({
      where,
      include,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(departments);
  } catch (e) {
    console.error("Departments list error:", e);
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
    const { name, code, description, facultyId, tuitionFee } = body;
    const parsedFacultyId = Number(facultyId);

    if (!name || !code || !Number.isInteger(parsedFacultyId)) {
      return NextResponse.json(
        { error: "Name, code and facultyId are required" },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        description: description || null,
        facultyId: parsedFacultyId,
        tuitionFee: tuitionFee != null ? Number(tuitionFee) : null,
      },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(department);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A department with this name or code already exists" },
        { status: 400 }
      );
    }
    console.error("Create department error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
