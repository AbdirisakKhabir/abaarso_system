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
    const where: Prisma.FacultyWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const include = {
      _count: { select: { departments: true } },
    } as const;

    const mapFaculty = (f: {
      id: number;
      name: string;
      code: string;
      description: string | null;
      program: string | null;
      isActive: boolean;
      createdAt: Date;
      _count: { departments: number };
    }) => ({
      id: f.id,
      name: f.name,
      code: f.code,
      description: f.description,
      program: f.program,
      isActive: f.isActive,
      departmentCount: f._count.departments,
      createdAt: f.createdAt,
    });

    if (paginate) {
      const [rows, total] = await Promise.all([
        prisma.faculty.findMany({
          where,
          skip,
          take: pageSize,
          include,
          orderBy: { name: "asc" },
        }),
        prisma.faculty.count({ where }),
      ]);
      return NextResponse.json({
        items: rows.map(mapFaculty),
        total,
        page,
        pageSize,
      });
    }

    const faculties = await prisma.faculty.findMany({
      where,
      include,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(faculties.map(mapFaculty));
  } catch (e) {
    console.error("Faculties list error:", e);
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
    const { name, code, description, program } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    const faculty = await prisma.faculty.create({
      data: {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        description: description || null,
        program: program || null,
      },
    });

    return NextResponse.json(faculty);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A faculty with this name or code already exists" },
        { status: 400 }
      );
    }
    console.error("Create faculty error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
